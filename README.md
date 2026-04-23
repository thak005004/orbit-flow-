🛸 Orbit Flow
A space logistics routing engine that computes optimal delivery paths across a network of orbital waypoints — with live shipment tracking, fuel cost estimation, and an interactive Dijkstra pathfinding visualizer.

Features: 
Pathfinding visualizer — step-through visualization of Dijkstra's algorithm across the orbital network
Live ETA display — in-transit shipment cards with real-time estimated arrival
Fuel cost estimator — calculates total fuel expenditure for any source → destination pair
Shipment management — create, track, and cancel shipments with inline confirmation
Dark / light mode — theme toggle with localStorage persistence


Tech Stack: 
TypeScript · React · Vite · Tailwind CSS

Getting Started: 
Prerequisites: Node.js v18+, npm
Steps: 
bashgit clone https://github.com/thak005004/orbit-flow-.git
cd orbit-flow-
npm install
npm run dev
Open http://localhost:5173 in your browser.

Project Structure: 
orbit-flow/
├── src/
│   ├── components/    # UI components — shipment cards, visualizer, ETA display
│   ├── data/          # Orbital network graph data
│   ├── utils/         # Dijkstra algorithm + priority queue
│   ├── types.ts       # Shared TypeScript types
│   ├── App.tsx        # Root component
│   └── main.tsx       # Entry point
├── index.html
├── vite.config.ts
└── tailwind.config.js

How It Works: 
Orbital network → weighted directed graph
        ↓
User selects source + destination
        ↓
Dijkstra via priority queue → optimal path
        ↓
Fuel cost + ETA derived from edge weights
        ↓
Visualizer traces path · shipment card goes live


Built with AI: 
Developed with Claude as an active pair-programming collaborator — used for debugging algorithm edge cases, building the fuel cost estimator, and implementing the live ETA and shipment card components.

What I Learned: 
How priority queue implementation choices affect Dijkstra performance at scale
Translating abstract graph output into UI readable for non-technical users
Structuring a React + TypeScript app around a core algorithmic engine
Using LLM tools as a development collaborator, not just a code generator
