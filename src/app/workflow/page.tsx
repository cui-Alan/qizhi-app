"use client";

import { ReactFlowProvider } from "@xyflow/react";
import { NodePalette } from "@/components/workflow/NodePalette";
import { FlowCanvas } from "@/components/workflow/FlowCanvas";
import { YamlPanel } from "@/components/workflow/YamlPanel";

export default function WorkflowPage() {
  return (
    <div className="h-full flex">
      <ReactFlowProvider>
        <NodePalette />
        <FlowCanvas />
        <YamlPanel />
      </ReactFlowProvider>
    </div>
  );
}
