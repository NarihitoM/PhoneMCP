import assert from "node:assert/strict";
import { test } from "node:test";
import { formatElements, parseUiDump } from "./ui.js";

const SAMPLE = `<?xml version='1.0' encoding='UTF-8' standalone='yes' ?><hierarchy rotation="0">
<node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.android.settings" content-desc="" clickable="false" scrollable="false" focused="false" bounds="[0,0][1080,2400]">
<node index="0" text="Wi-Fi &amp; network" resource-id="android:id/title" class="android.widget.TextView" package="com.android.settings" content-desc="" clickable="false" scrollable="false" focused="false" bounds="[100,300][600,360]" />
<node index="1" text="" resource-id="com.android.settings:id/search" class="android.widget.ImageButton" package="com.android.settings" content-desc="Search settings" clickable="true" scrollable="false" focused="false" bounds="[900,100][1000,200]" />
<node index="2" text="" resource-id="com.android.settings:id/list" class="androidx.recyclerview.widget.RecyclerView" package="com.android.settings" content-desc="" clickable="false" scrollable="true" focused="false" bounds="[0,250][1080,2400]" />
<node index="3" text="" resource-id="com.android.settings:id/query" class="android.widget.EditText" package="com.android.settings" content-desc="" clickable="false" scrollable="false" focused="true" bounds="[0,0][1080,80]" />
<node index="4" text="Hidden" resource-id="" class="android.widget.TextView" package="com.android.settings" content-desc="" clickable="true" scrollable="false" focused="false" bounds="[0,0][0,0]" />
</node>
</hierarchy>`;

test("parseUiDump keeps meaningful nodes and skips empty containers", () => {
  const elements = parseUiDump(SAMPLE);

  assert.equal(elements.length, 4);
  assert.deepEqual(
    elements.map((element) => element.index),
    [0, 1, 2, 3],
  );
});

test("parseUiDump decodes entities and computes centers", () => {
  const [title, search] = parseUiDump(SAMPLE);

  assert.equal(title?.text, "Wi-Fi & network");
  assert.deepEqual(title?.center, { x: 350, y: 330 });
  assert.equal(search?.description, "Search settings");
  assert.equal(search?.clickable, true);
});

test("parseUiDump keeps editable and scrollable nodes", () => {
  const elements = parseUiDump(SAMPLE);

  assert.equal(elements[2]?.scrollable, true);
  assert.equal(elements[3]?.className, "android.widget.EditText");
  assert.equal(elements[3]?.focused, true);
});

test("formatElements renders a compact line per element", () => {
  const lines = formatElements(parseUiDump(SAMPLE)).split("\n");

  assert.equal(lines[0], '[0] TextView "Wi-Fi & network" id=title (350,330)');
  assert.equal(lines[1], '[1] ImageButton desc="Search settings" id=search (950,150) clickable');
});

test("formatElements explains an empty screen", () => {
  assert.match(formatElements([]), /screenshot/);
});
