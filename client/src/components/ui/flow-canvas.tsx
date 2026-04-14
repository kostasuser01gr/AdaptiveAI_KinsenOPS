import React, { useCallback, useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  useNodesState,
  useEdgesState,
  addEdge,
  MarkerType,
  Panel,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

interface FlowCanvasProps {
  initialNodes: Node[];
  initialEdges: Edge[];
  onNodesChange?: (nodes: Node[]) => void;
  onEdgesChange?: (edges: Edge[]) => void;
  readOnly?: boolean;
  className?: string;
  showMiniMap?: boolean;
  showControls?: boolean;
  children?: React.ReactNode;
}

export function FlowCanvas({
  initialNodes,
  initialEdges,
  onNodesChange: onNodesProp,
  onEdgesChange: onEdgesProp,
  readOnly = false,
  className,
  showMiniMap = true,
  showControls = true,
  children,
}: FlowCanvasProps) {
  const [nodes, setNodes, handleNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, handleEdgesChange] = useEdgesState(initialEdges);

  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges]
  );

  return (
    <div className={`w-full h-full min-h-[400px] rounded-xl overflow-hidden border bg-background/50 ${className || ''}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={readOnly ? undefined : handleNodesChange}
        onEdgesChange={readOnly ? undefined : handleEdgesChange}
        onConnect={readOnly ? undefined : onConnect}
        nodesDraggable={!readOnly}
        nodesConnectable={!readOnly}
        elementsSelectable={!readOnly}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} className="!bg-background" />
        {showControls && <Controls className="!bg-card !border-border !shadow-lg" />}
        {showMiniMap && (
          <MiniMap
            className="!bg-card !border-border"
            nodeColor="#8b5cf6"
            maskColor="rgba(0,0,0,0.2)"
          />
        )}
        {children}
      </ReactFlow>
    </div>
  );
}

// Helper: Convert a simple graph structure to React Flow nodes/edges
export function graphToFlow(
  nodes: { id: string; label: string; type?: string; x?: number; y?: number }[],
  edges: { source: string; target: string; label?: string }[]
): { nodes: Node[]; edges: Edge[] } {
  return {
    nodes: nodes.map((n, i) => ({
      id: n.id,
      data: { label: n.label },
      position: { x: n.x ?? (i % 4) * 200, y: n.y ?? Math.floor(i / 4) * 120 },
      type: n.type || 'default',
      style: {
        background: 'hsl(var(--card))',
        color: 'hsl(var(--card-foreground))',
        border: '1px solid hsl(var(--border))',
        borderRadius: '0.5rem',
        padding: '8px 16px',
        fontSize: '12px',
      },
    })),
    edges: edges.map((e, i) => ({
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      label: e.label,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: 'hsl(var(--primary) / 0.5)' },
      labelStyle: { fontSize: '10px', fill: 'hsl(var(--muted-foreground))' },
    })),
  };
}
