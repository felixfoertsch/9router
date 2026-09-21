import { describe, expect, it } from "vitest";
import { convertResponsesStreamToJson } from "../../open-sse/transformer/streamToJsonConverter.js";

function stream(events, includeEvent = true, newline = "\n") {
  return new Response(events.map(([event, data]) => `${includeEvent ? `event: ${event}${newline}` : ""}data: ${JSON.stringify(data)}${newline}${newline}`).join("")).body;
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

  it("parses CRLF-delimited events", async () => {
    const response = await convertResponsesStreamToJson(stream([
      ["response.output_item.added", { output_index: 0, item: { type: "message", role: "assistant", content: [] } }],
      ["response.output_text.delta", { output_index: 0, content_index: 0, delta: "OK" }],
      ["response.completed", { response: {} }],
    ], true, "\r\n"));

    expect(response.status).toBe("completed");
    expect(response.output[0].content[0].text).toBe("OK");
  });

  it("parses events separated by blank lines containing whitespace", async () => {
    const body = [
      `event: response.output_item.added\ndata: ${JSON.stringify({ output_index: 0, item: { type: "message", role: "assistant", content: [] } })}`,
      `event: response.output_text.delta\ndata: ${JSON.stringify({ output_index: 0, content_index: 0, delta: "OK" })}`,
      `event: response.completed\ndata: ${JSON.stringify({ response: {} })}`,
    ].join("\n \n");
    const response = await convertResponsesStreamToJson(new Response(body).body);

    expect(response.status).toBe("completed");
    expect(response.output[0].content[0].text).toBe("OK");
  });

  it("uses data.type when SSE event lines are absent", async () => {
    const response = await convertResponsesStreamToJson(stream([
      ["response.created", { type: "response.created", response: { id: "resp_test", created_at: 1 } }],
      ["response.output_item.added", { type: "response.output_item.added", output_index: 0, item: { type: "message", role: "assistant", content: [] } }],
      ["response.output_text.delta", { type: "response.output_text.delta", output_index: 0, content_index: 0, delta: "OK" }],
      ["response.completed", { type: "response.completed", response: {} }],
    ], false));

    expect(response.status).toBe("completed");
    expect(response.output[0].content[0].text).toBe("OK");
  });
});
