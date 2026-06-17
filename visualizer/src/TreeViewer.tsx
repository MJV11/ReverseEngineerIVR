import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo } from "react";
import { IvrFlowEdge } from "./IvrFlowEdge";
import { IvrFlowNode } from "./IvrFlowNode";
import { treeToGraph, type GraphNodeData } from "./treeToGraph";
import type { SerializedIvrNode, SerializedIvrTree } from "./types";

const nodeTypes = { ivrNode: IvrFlowNode };
const edgeTypes = { ivrEdge: IvrFlowEdge };

interface TreeViewerProps {
  tree: SerializedIvrTree;
  selectedNodeId: string | null;
  onSelectNode: (node: SerializedIvrNode | null) => void;
}

export function TreeViewer({ tree, selectedNodeId, onSelectNode }: TreeViewerProps) {
  const graph = useMemo(() => treeToGraph(tree), [tree]);
  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);

  useEffect(() => {
    setNodes(
      graph.nodes.map((node) => ({
        ...node,
        selected: node.id === selectedNodeId,
      })),
    );
    setEdges(graph.edges);
  }, [graph, selectedNodeId, setEdges, setNodes]);

  return (
    <div className="graph-panel">
      <div className="legend">
        <span><i className="legend__swatch legend__swatch--tree" /> tree edge</span>
        <span><i className="legend__swatch legend__swatch--backprop" /> backprop</span>
        <span><i className="legend__swatch legend__swatch--loop" /> loop</span>
        <span><i className="legend__swatch legend__swatch--reverse" /> reverse</span>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        onNodeClick={(_, node) => {
          onSelectNode((node as Node<GraphNodeData>).data.node);
        }}
        onPaneClick={() => onSelectNode(null)}
      >
        <MiniMap pannable zoomable />
        <Controls />
        <Background gap={16} size={1} />
      </ReactFlow>
      {selectedNodeId && (
        <div className="graph-panel__hint">Showing all edges for the selected run, including backprop and loop links.</div>
      )}
    </div>
  );
}
