(function () {
  function latestMessages(messages) {
    const latest = new Map();
    for (const message of messages) {
      if (!message.conversation_id) continue;
      const timestamp = Date.parse(message.observed_at || message.created_at || '') || 0;
      const previous = latest.get(message.conversation_id);
      if (!previous || timestamp >= previous.timestamp) latest.set(message.conversation_id, { ...message, timestamp });
    }
    return latest;
  }

  async function loadMessages(client) {
    const messages = [];
    for (let offset = 0; offset < 10000; offset += 1000) {
      const { data, error } = await client.from('reachr_messages')
        .select('conversation_id,direction,body,observed_at,created_at')
        .order('created_at', { ascending: true }).range(offset, offset + 999);
      if (error) throw error;
      messages.push(...(data || []));
      if ((data || []).length < 1000) break;
      if (offset === 9000) throw new Error('Stored message scan exceeds 10,000 rows');
    }
    return messages;
  }

  window.reachrReplyTriage = { latestMessages, loadMessages };
})();
