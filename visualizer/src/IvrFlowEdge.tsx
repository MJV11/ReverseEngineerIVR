import { getBezierPath, type EdgeProps } from "@xyflow/react";
import type { GraphEdgeData } from "./treeToGraph";

export function IvrFlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  label,
  data,
  selected,
}: EdgeProps) {
  const edgeData = data as GraphEdgeData | undefined;
  const kind = edgeData?.kind ?? "tree";
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
      <path
        id={id}
        className={`flow-edge flow-edge--${kind}${selected ? " flow-edge--selected" : ""}`}
        d={edgePath}
        markerEnd={markerEnd}
        fill="none"
      />
      {label && (
        <foreignObject
          x={labelX - 80}
          y={labelY - 14}
          width={160}
          height={28}
          className="flow-edge__label-host"
          requiredExtensions="http://www.w3.org/1999/xhtml"
        >
          <div className={`flow-edge__label flow-edge__label--${kind}`}>{label}</div>
        </foreignObject>
      )}
    </>
  );
}
