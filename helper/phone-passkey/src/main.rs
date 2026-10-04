//! Phone passkey helper: runs a WebAuthn GetAssertion over the hybrid (caBLE)
//! transport so an Electron app can sign in with a passkey stored on a phone.
//!
//! Protocol (newline-delimited JSON):
//!   stdin  (first line): {"origin": "...", "topOrigin": "..."|null, "publicKey": {<PublicKeyCredentialRequestOptionsJSON>}}
//!   stdout (one per line):
//!     {"type":"qr","url":"FIDO:/...","svg":"<svg ...>"}
//!     {"type":"status","state":"connecting"|"proximity"|"authenticating"|"connected"|"waiting-for-phone"}
//!     {"type":"result","credential":{<AuthenticationResponseJSON>}}   (terminal)
//!     {"type":"error","code":"...","message":"..."}                    (terminal)
//! Closing stdin (or SIGTERM) cancels the ceremony.

use std::io::Write;
use std::str::FromStr;
use std::time::Duration;

use libwebauthn::ops::webauthn::{
    DatFilePublicSuffixList, GetAssertionRequest, JsonFormat, Origin, OriginValidation,
    RelatedOrigins, RequestOrigin, RequestSettings, WebAuthnIDLResponse as _,
};
use libwebauthn::transport::cable::channel::{CableUpdate, CableUxUpdate};
use libwebauthn::transport::cable::is_available;
use libwebauthn::transport::cable::qr_code_device::{
    CableQrCodeDevice, CableTransports, QrCodeOperationHint,
};
use libwebauthn::transport::{Channel as _, ChannelSettings, Device};
use libwebauthn::webauthn::WebAuthn;
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, BufReader};

/// Hard cap for the whole ceremony (QR scan + phone interaction).
const CEREMONY_TIMEOUT: Duration = Duration::from_secs(180);

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Input {
    origin: String,
    top_origin: Option<String>,
    public_key: Value,
}

fn emit(value: Value) {
    let mut out = std::io::stdout().lock();
    let _ = writeln!(out, "{value}");
    let _ = out.flush();
}

fn fail(code: &str, message: impl std::fmt::Display) -> ! {
    emit(json!({ "type": "error", "code": code, "message": message.to_string() }));
    std::process::exit(1);
}

fn qr_svg(data: &str) -> String {
    use qrcode::render::svg;
    qrcode::QrCode::new(data.as_bytes())
        .map(|code| {
            code.render()
                .min_dimensions(240, 240)
                .quiet_zone(true)
                .dark_color(svg::Color("#000000"))
                .light_color(svg::Color("#ffffff"))
                .build()
        })
        .unwrap_or_default()
}

#[tokio::main]
async fn main() {
    let mut stdin = BufReader::new(tokio::io::stdin());
    let mut line = String::new();
    if stdin.read_line(&mut line).await.unwrap_or(0) == 0 {
        fail("bad-input", "no request on stdin");
    }
    let input: Input = match serde_json::from_str(&line) {
        Ok(i) => i,
        Err(e) => fail("bad-input", format!("invalid request: {e}")),
    };

    // Cancellation: parent closing stdin aborts the ceremony.
    tokio::spawn(async move {
        let mut sink = String::new();
        loop {
            sink.clear();
            match stdin.read_line(&mut sink).await {
                Ok(0) | Err(_) => std::process::exit(0),
                Ok(_) => {}
            }
        }
    });

    match tokio::time::timeout(CEREMONY_TIMEOUT, run(input)).await {
        Ok(()) => {}
        Err(_) => fail("timeout", "timed out waiting for the phone"),
    }
}

async fn run(input: Input) {
    if !is_available().await {
        fail("no-bluetooth", "No Bluetooth adapter available (phone passkeys need Bluetooth)");
    }

    let origin = match Origin::from_str(&input.origin) {
        Ok(o) => o,
        Err(e) => fail("bad-origin", format!("{e:?}")),
    };
    let request_origin = match input.top_origin.as_deref() {
        Some(top) if top != input.origin => match Origin::from_str(top) {
            Ok(t) => RequestOrigin::new_cross_origin(origin, t),
            Err(e) => fail("bad-origin", format!("{e:?}")),
        },
        _ => RequestOrigin::new(origin),
    };

    let psl = match DatFilePublicSuffixList::from_system_file() {
        Ok(p) => p,
        Err(e) => fail(
            "no-psl",
            format!("Public Suffix List not found (install 'publicsuffix-list'): {e:?}"),
        ),
    };
    let settings = RequestSettings {
        origin: OriginValidation::Validate {
            public_suffix_list: &psl,
            related_origins: RelatedOrigins::Disabled,
        },
    };

    let request = match GetAssertionRequest::prepare(
        &request_origin,
        &input.public_key.to_string(),
        &settings,
    )
    .await
    {
        Ok(r) => r,
        Err(e) => fail("bad-request", format!("{e:?}")),
    };

    // CloudAssistedOnly: widest compatibility with phones' Play Services.
    let mut device = match CableQrCodeDevice::new_transient(
        QrCodeOperationHint::GetAssertionRequest,
        CableTransports::CloudAssistedOnly,
    ) {
        Ok(d) => d,
        Err(e) => fail("qr", format!("{e:?}")),
    };
    let url = device.qr_code.to_string();
    emit(json!({ "type": "qr", "url": url, "svg": qr_svg(&url) }));

    let mut channel = match device.channel(ChannelSettings::default()).await {
        Ok(c) => c,
        Err(e) => fail("channel", format!("{e:?}")),
    };
    emit(json!({ "type": "status", "state": "waiting-for-scan" }));

    let mut updates = channel.get_ux_update_receiver();
    tokio::spawn(async move {
        while let Ok(update) = updates.recv().await {
            let state = match update {
                CableUxUpdate::CableUpdate(CableUpdate::ProximityCheck) => "proximity",
                CableUxUpdate::CableUpdate(CableUpdate::Connecting) => "connecting",
                CableUxUpdate::CableUpdate(CableUpdate::Authenticating) => "authenticating",
                CableUxUpdate::CableUpdate(CableUpdate::Connected) => "waiting-for-phone",
                CableUxUpdate::CableUpdate(CableUpdate::Error(e)) => {
                    emit(json!({ "type": "status", "state": "error", "message": e.to_string() }));
                    continue;
                }
                CableUxUpdate::UvUpdate(_) => "waiting-for-phone",
            };
            emit(json!({ "type": "status", "state": state }));
        }
    });

    let response = match channel.webauthn_get_assertion(&request).await {
        Ok(r) => r,
        Err(e) => fail("assertion", format!("{e:?}")),
    };
    let Some(assertion) = response.assertions.first() else {
        fail("no-assertion", "phone returned no assertion");
    };
    match assertion.to_json_string(&request, JsonFormat::Minified) {
        Ok(json_str) => match serde_json::from_str::<Value>(&json_str) {
            Ok(credential) => emit(json!({ "type": "result", "credential": credential })),
            Err(e) => fail("serialize", e),
        },
        Err(e) => fail("serialize", format!("{e:?}")),
    }
}
