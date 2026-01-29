"use client";

import "@crayonai/react-ui/styles/index.css";
import {
  C1Chat,
  ThemeProvider,
  useThreadListManager,
  useThreadManager,
} from "@thesysai/genui-sdk";
import { SpreadsheetTable } from "./components";
import { TableProvider, useTableContext } from "./TableContext";
import { useEffect } from "react";

function ChatWithTable() {
  const { setThreadId } = useTableContext();

  const threadListManager = useThreadListManager({
    fetchThreadList: async () => [],
    createThread: async () => {
      const id = crypto.randomUUID();
      return { 
        threadId: id, 
        title: "New Thread",
        createdAt: new Date(),
      };
    },
    deleteThread: async () => {},
    updateThread: async (thread) => thread,
    onSwitchToNew: () => {},
    onSelectThread: () => {},
  });

  const threadManager = useThreadManager({
    threadListManager,
    loadThread: async () => [],
    onUpdateMessage: async () => {},
    apiUrl: "/api/chat",
    customizeC1: {
      customComponents: { SpreadsheetTable },
    },
  });

  // Update context whenever the selected thread changes
  useEffect(() => {
    const selectedId = threadListManager.selectedThreadId;
    if (selectedId) {
      setThreadId(selectedId);
    }
  }, [threadListManager.selectedThreadId, setThreadId]);

  return (
    <C1Chat
      threadManager={threadManager}
      threadListManager={threadListManager}
      customizeC1={{
        customComponents: { SpreadsheetTable },
      }}
    />
  );
}

export default function Home() {
  return (
    <ThemeProvider mode="dark">
      <TableProvider>
        <ChatWithTable />
      </TableProvider>
    </ThemeProvider>
  );
}
