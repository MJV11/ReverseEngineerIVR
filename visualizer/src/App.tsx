import { useEffect, useMemo, useState } from "react";
import { NodeInspector } from "./NodeInspector";
import { TreeViewer } from "./TreeViewer";
import type { SerializedIvrTree } from "./types";

async function fetchOutputList(): Promise<string[]> {
  const response = await fetch("/api/outputs");
  if (!response.ok) {
    throw new Error("Failed to list outputs");
  }
  return response.json() as Promise<string[]>;
}

async function fetchOutput(fileName: string): Promise<SerializedIvrTree> {
  const response = await fetch(`/api/outputs/${encodeURIComponent(fileName)}`);
  if (!response.ok) {
    throw new Error(`Failed to load ${fileName}`);
  }
  return response.json() as Promise<SerializedIvrTree>;
}

function initialOutputFile(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("output") ?? "";
}

export default function App() {
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>(initialOutputFile());
  const [tree, setTree] = useState<SerializedIvrTree | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOutputList()
      .then((outputFiles) => {
        setFiles(outputFiles);
        const requested = initialOutputFile();
        if (requested && outputFiles.includes(requested)) {
          setSelectedFile(requested);
        } else if (outputFiles.length > 0) {
          setSelectedFile((current) => current || outputFiles[0]);
        }
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedFile) {
      setTree(null);
      return;
    }

    setLoading(true);
    setError(null);
    setSelectedNodeId(null);

    fetchOutput(selectedFile)
      .then(setTree)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [selectedFile]);

  const selectedNode = useMemo(() => {
    if (!tree || !selectedNodeId) {
      return null;
    }
    return tree.nodes.find((node) => node.id === selectedNodeId) ?? null;
  }, [selectedNodeId, tree]);

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>IVR Tree Visualizer</h1>
          <p className="muted">Inspect discovered phone trees from `outputs/*.json`.</p>
        </div>
        <label className="file-picker">
          <span>Output</span>
          <select
            value={selectedFile}
            onChange={(event) => setSelectedFile(event.target.value)}
            disabled={files.length === 0}
          >
            {files.length === 0 ? (
              <option value="">No JSON outputs yet</option>
            ) : (
              files.map((file) => (
                <option key={file} value={file}>
                  {file}
                </option>
              ))
            )}
          </select>
        </label>
      </header>

      {error && <div className="banner banner--error">{error}</div>}
      {loading && <div className="banner">Loading…</div>}
      {!loading && files.length === 0 && (
        <div className="banner">
          No JSON outputs found. Run `npm start explore` to generate `outputs/*.json`, then refresh.
        </div>
      )}

      {tree && (
        <main className="layout">
          <TreeViewer
            tree={tree}
            selectedNodeId={selectedNodeId}
            onSelectNode={(node) => setSelectedNodeId(node?.id ?? null)}
          />
          <NodeInspector tree={tree} node={selectedNode} />
        </main>
      )}
    </div>
  );
}
