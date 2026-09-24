import assert from "node:assert/strict";
import { describe, it } from "vitest";

import { openaiResponsesToOpenAIResponse } from "../../open-sse/translator/response/openai-responses.js";

describe("Responses incomplete translation", () => {
  it("surfaces output-budget exhaustion instead of an empty successful response", () => {
    const state = { model: "muse-spark-1.3-contributor-free" };
    const chunk = openaiResponsesToOpenAIResponse({
      type: "response.incomplete",
      response: { status: "incomplete", incomplete_details: { reason: "max_output_tokens" } },
    }, state);

    assert.equal(chunk.choices[0].finish_reason, "length");
    assert.match(chunk.choices[0].delta.content, /max_output_tokens/);
  });
});
