import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { transformStream } from "@crayonai/stream";
import { tools, setCurrentThreadId } from "./tools";
import { DBMessage, getMessageStore } from "./messageStore";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

type ThreadId = string;

// Zod schema for the SpreadsheetTable component
const SpreadsheetTableSchema = z
  .object({
    data: z
      .array(z.array(z.union([z.string(), z.number(), z.null()])))
      .describe(
        "2D array of cell values. Each inner array is a row. Values can be numbers, strings, or Excel-like formulas starting with ="
      ),
    colHeaders: z
      .array(z.string())
      .optional()
      .describe("Array of column header names"),
    height: z
      .number()
      .optional()
      .describe("Height of the table in pixels. Default is 400."),
    title: z
      .string()
      .optional()
      .describe("Optional title displayed above the table"),
  })
  .describe(
    "An interactive Excel-like spreadsheet table powered by Handsontable. Supports formulas (=SUM, =AVERAGE, =IF, etc.), cell editing, row/column operations via context menu. Use this to display tabular data that users can interact with. Always include colHeaders for clarity."
  );

const CUSTOM_COMPONENT_SCHEMAS = {
  SpreadsheetTable: zodToJsonSchema(SpreadsheetTableSchema),
};

const SYSTEM_PROMPT = `You are a helpful spreadsheet assistant using Thesys C1.

You help users work with tabular data in an Excel-like spreadsheet. You can:
- View and analyze the current table data
- Update individual cells or ranges
- Add formulas (386+ Excel-compatible functions supported)
- Add or delete rows and columns
- Query/filter data to find specific information

IMPORTANT GUIDELINES:
1. ALWAYS call get_table_data first to see the current state of the spreadsheet
2. When displaying data, ALWAYS use the SpreadsheetTable component
3. Use formulas for calculations - they update automatically when data changes
4. Common formulas: =SUM(range), =AVERAGE(range), =COUNT(range), =MAX(range), =MIN(range), =IF(condition, true_val, false_val)
5. Cell references use Excel notation: A1 = row 1, column A. Columns are A, B, C... and rows are 1, 2, 3...
6. For tool calls, use zero-based indices (row 0, col 0 = cell A1)
7. Explain what you're doing and the results of calculations to the user

When the user asks to modify data, first get the current data, make the changes, then display the updated SpreadsheetTable.`;

export async function POST(req: NextRequest) {
  const { prompt, threadId, responseId } = (await req.json()) as {
    prompt: {
      role: "user";
      content: string;
      id: string;
    };
    threadId: ThreadId;
    responseId: string;
  };

  // Set the current thread ID for tool execution
  setCurrentThreadId(threadId);

  const messageStore = getMessageStore(threadId);

  // Initialize with system prompt on first message
  if (messageStore.getOpenAICompatibleMessageList().length === 0) {
    messageStore.addMessage({
      role: "system",
      content: SYSTEM_PROMPT,
    });
  }

  // Store the user prompt
  messageStore.addMessage(prompt as DBMessage);

  const client = new OpenAI({
    baseURL: "https://api.thesys.dev/v1/embed/",
    apiKey: process.env.THESYS_API_KEY,
  });

  const llmStream = client.chat.completions.runTools({
    model: "c1/anthropic/claude-sonnet-4/v-20250930",
    messages: messageStore.getOpenAICompatibleMessageList(),
    stream: true,
    tools,
    metadata: {
      thesys: JSON.stringify({
        c1_custom_components: CUSTOM_COMPONENT_SCHEMAS,
      }),
    },
  });

  const responseStream = transformStream(
    llmStream,
    (chunk) => {
      return chunk.choices?.[0]?.delta?.content;
    },
    {
      onEnd: ({ accumulated }) => {
        const message = accumulated.filter((m) => m).join("");
        messageStore.addMessage({
          role: "assistant",
          content: message,
          id: responseId,
        });
      },
    }
  ) as ReadableStream<string>;

  return new NextResponse(responseStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
