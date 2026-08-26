# 7-Segment Display Simulator

Interactive 7-segment display simulator with BCD and Hexadecimal modes,
common cathode/anode support, Karnaugh maps, Boolean expressions, Verilog export,
and a real-time segment timing diagram.

## Development

From the repository root:

```bash
npm install
npm run build        # compile all apps
npm run build:web3   # compile Web3 only
npm run dev          # start dev server at localhost:5173
npm run test         # run unit tests
```

## Build Output

`Web3/script.js` is the committed compiled artifact generated from
`Web3/script.ts` via esbuild. Do not edit `script.js` directly.
