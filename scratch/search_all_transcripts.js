const fs = require('fs');
const path = require('path');
const readline = require('readline');

async function searchTranscript(filePath) {
  if (!fs.existsSync(filePath)) return;
  const rl = readline.createInterface({ input: fs.createReadStream(filePath) });
  for await (const line of rl) {
    if (line.includes('"type":"USER_INPUT"')) {
      try {
        const obj = JSON.parse(line);
        console.log(`[${path.basename(path.dirname(path.dirname(filePath)))}] Step ${obj.step_index}: ${obj.content.slice(0, 300).replace(/\r?\n/g, ' ')}`);
      } catch (e) {}
    }
  }
}

async function main() {
  const brainDir = 'C:\\Users\\samuv\\.gemini\\antigravity-ide\\brain';
  const dirs = fs.readdirSync(brainDir);
  for (const dir of dirs) {
    const transcriptPath = path.join(brainDir, dir, '.system_generated', 'logs', 'transcript.jsonl');
    await searchTranscript(transcriptPath);
  }
}

main();
