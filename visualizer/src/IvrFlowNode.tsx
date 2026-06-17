import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { GraphNodeData } from "./treeToGraph";

export function IvrFlowNode({ data, selected }: NodeProps) {
  const graphData = data as GraphNodeData & {
    kind: string;
    subtitle: string;
    pathwayLabel: string;
    confidence?: number;
  };
  const { node, kind, subtitle, pathwayLabel, confidence } = graphData;

  return (
    <div className={`flow-node flow-node--${kind}${selected ? " flow-node--selected" : ""}`}>
      <Handle type="target" position={Position.Top} />
      <div className="flow-node__path">{pathwayLabel}</div>
      <div className="flow-node__title">{node.title}</div>
      {confidence !== undefined && (
        <div className="flow-node__confidence">conf {confidence.toFixed(2)}</div>
      )}
      {subtitle && <div className="flow-node__subtitle">{subtitle}</div>}
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
