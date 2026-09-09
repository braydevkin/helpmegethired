import { VERIFICATION_CODE_LIFETIME_SECONDS } from "@helpmegethired/shared";

import { html, type Html } from "../lib/html";

export interface CodeEmail {
  subject: string;
  text: string;
  html: string;
}

const BRAND_NAME = "Help Me Get Hired";
const CODE_LIFETIME_MINUTES = VERIFICATION_CODE_LIFETIME_SECONDS / 60;

const lead = `Enter this code to finish signing in. It expires in ${CODE_LIFETIME_MINUTES} minutes.`;
const ignoreNote = "If you didn't ask for this code, you can ignore this email.";
const footer = "No passwords. We send a one-time code every time.";

// Design tokens from the Account design page. Email clients ignore stylesheets
// and custom properties, so the values are inlined; Manrope is not embedded and
// the system stack takes over.
const theme = {
  fontFamily: "Manrope, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  ink: "#0F1A14",
  textMuted: "#5F7268",
  textPlaceholder: "#9AAFA3",
  brand: "#0E7C4A",
  brandDeep: "#06301F",
  accent: "#2ECC71",
  fieldReadonly: "#F5F8F6",
  border: "#DDE5E0",
  surface: "#FFFFFF",
};

const font = `font-family: ${theme.fontFamily};`;

export function renderCodeEmail(code: string): CodeEmail {
  return {
    subject: `${code} is your ${BRAND_NAME} code`,
    text: renderText(code),
    html: renderHtml(code).toString(),
  };
}

function renderText(code: string): string {
  return [`Your ${BRAND_NAME} code`, "", code, "", lead, "", ignoreNote, footer, ""].join("\n");
}

function renderHtml(code: string): Html {
  return html`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Your ${BRAND_NAME} code</title>
</head>
<body style="margin: 0; padding: 0; background: ${theme.fieldReadonly}; ${font}">
<div style="display: none; max-height: 0; overflow: hidden; opacity: 0;">${code} is your ${BRAND_NAME} code. ${lead}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background: ${theme.fieldReadonly};">
  <tr>
    <td align="center" style="padding: 40px 16px;">
      ${renderCard(code)}
    </td>
  </tr>
</table>
</body>
</html>
`;
}

function renderCard(code: string): Html {
  return html`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 520px; background: ${theme.surface}; border: 1px solid ${theme.border}; border-radius: 16px;">
        <tr>
          <td style="padding: 32px 32px 0;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="width: 30px; height: 30px; background: ${theme.accent}; border-radius: 9px; text-align: center; vertical-align: middle; ${font} font-size: 15px; font-weight: 800; color: ${theme.brandDeep};">H</td>
                <td style="padding-left: 10px; ${font} font-size: 16px; font-weight: 700; color: ${theme.ink};">${BRAND_NAME}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 32px 32px 0; ${font} font-size: 13px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: ${theme.brand};">One-time code</td>
        </tr>
        <tr>
          <td style="padding: 10px 32px 0; ${font} font-size: 28px; line-height: 1.12; font-weight: 800; letter-spacing: -0.03em; color: ${theme.ink};">Your code to get in</td>
        </tr>
        <tr>
          <td style="padding: 12px 32px 0; ${font} font-size: 16px; line-height: 1.5; color: ${theme.textMuted};">${lead}</td>
        </tr>
        <tr>
          <td style="padding: 24px 32px 0;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="padding: 20px 16px; background: ${theme.fieldReadonly}; border: 1.5px solid ${theme.border}; border-radius: 12px; ${font} font-size: 32px; line-height: 1; font-weight: 700; letter-spacing: 0.3em; text-indent: 0.3em; color: ${theme.ink};">${code}</td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding: 24px 32px 32px; ${font} font-size: 12.5px; line-height: 1.55; color: ${theme.textPlaceholder};">${ignoreNote}<br>${footer}</td>
        </tr>
      </table>`;
}
