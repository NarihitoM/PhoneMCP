import assert from "node:assert/strict";
import { test } from "node:test";
import { encodeInputText, isTypeableText, shellQuote } from "./text.js";

test("shellQuote wraps in single quotes and escapes embedded quotes", () => {
  assert.equal(shellQuote("hello"), "'hello'");
  assert.equal(shellQuote("it's"), `'it'\\''s'`);
  assert.equal(shellQuote("a; rm -rf /"), "'a; rm -rf /'");
});

test("encodeInputText turns spaces into %s and keeps shell specials quoted", () => {
  assert.equal(encodeInputText("hello world"), "'hello%sworld'");
  assert.equal(encodeInputText("$(reboot) & `id`"), "'$(reboot)%s&%s`id`'");
});

test("isTypeableText accepts printable ASCII only", () => {
  assert.equal(isTypeableText("Hello, world! 123"), true);
  assert.equal(isTypeableText("line\nbreak"), false);
  assert.equal(isTypeableText("नमस्ते"), false);
});
