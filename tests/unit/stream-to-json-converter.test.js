import { describe, expect, it } from "vitest";
import { convertResponsesStreamToJson } from "../../open-sse/transformer/streamToJsonConverter.js";

function stream(events) {
  return new Response(events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join("")).body;
}

describe("convertResponsesStreamToJson", () => {
  it("builds a completed message from text deltas without output_item.done", async () => {
    const response = await convertResponsesStreamToJson(stream([
      ["response.created", { response: { id: "resp_test", created_at: 1 } }],
      ["response.output_item.added", { output_index: 0, item: { id: "msg_test", type: "message", role: "assistant", content: [] } }],
      ["response.output_text.delta", { output_index: 0, content_index: 0, delta: "O" }],
      ["response.output_text.delta", { output_index: 0, content_index: 0, delta: "K" }],
      ["response.completed", { response: { usage: { input_tokens: 2, output_tokens: 1, total_tokens: 3 } } }],
    ]));

    expect(response.status).toBe("completed");
    expect(response.output).toEqual([{
      id: "msg_test",
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: "OK", annotations: [] }],
    }]);
  });
});
