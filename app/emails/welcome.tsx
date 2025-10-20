import { Button, Html, Body } from "@react-email/components";
import * as React from "react";
//import 'web-streams-polyfill/polyfill';

export default function Welcome() {
  return (
    <Html>
      <Body>
        <Button
          href="https://example.com"
          style={{ background: "#000", color: "#fff", padding: "12px 20px" }}
        >
          Click me
        </Button>
      </Body>
    </Html>
  );
}