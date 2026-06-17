import type { SerializedIvrNode, SerializedIvrTree } from "./types";

interface NodeInspectorProps {
  tree: SerializedIvrTree;
  node: SerializedIvrNode | null;
}

function formatPathway(pathway: string[]): string {
  return pathway.length === 0 ? "/root" : `/${pathway.join("/")}`;
}

function nodeFlags(node: SerializedIvrNode): string[] {
  const flags: string[] = [];
  if (node.explored) flags.push("explored");
  if (node.failed) flags.push("failed");
  if (node.isTerminal) flags.push("terminal");
  if (node.loopGuard) flags.push("loop guard");
  if (node.unknownOption) flags.push("unknown option");
  if (node.sameAsParent) flags.push("same as parent");
  if (node.backpropEdge) flags.push("backprop edge");
  if (node.speakingOption) flags.push("spoken option");
  if (node.loopTo) flags.push(`loops to ${formatPathway(node.loopTo)}`);
  return flags;
}

function sourceTranscript(node: SerializedIvrNode): string | undefined {
  if (node.sourceCallId) {
    const match = node.calls.find((call) => call.callId === node.sourceCallId);
    if (match?.transcript?.trim()) {
      return match.transcript.trim();
    }
  }
  return node.calls.find((call) => call.transcript?.trim())?.transcript?.trim();
}

export function NodeInspector({ tree, node }: NodeInspectorProps) {
  if (!node) {
    return (
      <aside className="inspector">
        <h2>Node details</h2>
        <p className="muted">Select a node in the graph to inspect its prompt, options, transcript, and confidence.</p>
        {tree.stats && (
          <section className="inspector__section">
            <h3>Run stats</h3>
            <dl className="stats-grid">
              <div><dt>Pathways</dt><dd>{tree.stats.pathwaysExplored}</dd></div>
              <div><dt>Calls</dt><dd>{tree.stats.callsPlaced}</dd></div>
              <div><dt>Backprop edges</dt><dd>{tree.stats.backpropSkipped}</dd></div>
              <div><dt>Loops</dt><dd>{tree.stats.loops}</dd></div>
            </dl>
          </section>
        )}
      </aside>
    );
  }

  const options =
    node.optionConfidences ??
    node.edges.map((edge) => ({
      key: edge.key,
      label: edge.label,
      confidence: NaN,
    }));

  const transcript = sourceTranscript(node);
  const flags = nodeFlags(node);

  return (
    <aside className="inspector">
      <h2>{formatPathway(node.pathway)}</h2>
      <p className="inspector__phone">{tree.phoneNumber}</p>

      <section className="inspector__section">
        <h3>Prompt</h3>
        <p className="prompt">{node.title}</p>
        {node.confidence !== undefined && (
          <p>
            <span className="badge">confidence {node.confidence.toFixed(2)}</span>
            {node.attempts !== undefined && (
              <span className="badge badge--muted">{node.attempts} attempts</span>
            )}
          </p>
        )}
        {flags.length > 0 && (
          <div className="flag-row">
            {flags.map((flag) => (
              <span key={flag} className="flag">
                {flag}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="inspector__section">
        <h3>Options</h3>
        {options.length === 0 ? (
          <p className="muted">No menu options recorded.</p>
        ) : (
          <ul className="option-list">
            {options.map((option) => {
              const edge = node.edges.find((item) => item.key === option.key);
              return (
                <li key={option.key} className="option-list__item">
                  <div className="option-list__key">{option.key}</div>
                  <div>
                    <div>{option.label}</div>
                    <div className="option-list__meta">
                      {!Number.isNaN(option.confidence) && (
                        <span>p={option.confidence.toFixed(2)}</span>
                      )}
                      {edge?.isBackprop && <span className="edge-tag edge-tag--backprop">backprop</span>}
                      {edge?.isReverse && <span className="edge-tag edge-tag--reverse">reverse</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="inspector__section">
        <h3>Source transcript</h3>
        {node.sourceCallId && (
          <p className="muted">source call: {node.sourceCallId}</p>
        )}
        {transcript ? (
          <pre className="transcript">{transcript}</pre>
        ) : (
          <p className="muted">No transcript stored for this node.</p>
        )}
      </section>

      {node.calls.length > 0 && (
        <section className="inspector__section">
          <h3>Calls ({node.calls.length})</h3>
          <ul className="call-list">
            {node.calls.map((call) => (
              <li key={`${call.callId}-${call.timestamp}`}>
                <strong>{call.callId}</strong>
                <span className="muted">
                  {[
                    call.status,
                    call.answeredBy && `answered_by=${call.answeredBy}`,
                    call.durationSec !== undefined && `${call.durationSec}s`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </aside>
  );
}
