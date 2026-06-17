1. stack for traversing edges. when a new edge is available in the stack, pop it, spin up a new agent, and explore the pathway. Pathways are represented as numbers.
2. graph/tree for representing the IVR, with each number:title pair being the name of the node. each node has subsequent edges. reverse edges are possible. When we reverse an edge that is the end of the tree.
3. a means to take discovered pathways and transcribe them into our graph
4. call the actual number and proceed down the path. most IVRs have a system of "press x for y". Take that transcript from the bland api and extract the x and y. that's a node!
