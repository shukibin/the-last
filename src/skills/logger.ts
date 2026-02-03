import fs from 'fs';

export function logConversation(conversationId: string, data: { prompt: string; response: string }) {
  const folderPath = `/app/workspace/conversations/${conversationId}`;
  if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
  }

  const filePath = `${folderPath}/log.json`;
  let logData: Array<{ prompt: string; response: string }> = [];

  if (fs.existsSync(filePath)) {
    try {
      logData = JSON.parse(fs.readFileSync(filePath, 'utf8')) || [];
    } catch (error) {
      console.error('Error reading conversation log:', error);
    }
  }

  logData.push(data);

  fs.writeFileSync(filePath, JSON.stringify(logData, null, 2));
}