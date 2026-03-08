// Queries for the notes subgraph

export const NOTES_BY_ORDER_QUERY = `
  query NotesByOrder($orderId: BigInt!, $user: Bytes!) {
    notes(where: { orderId: $orderId }, orderBy: noteId, orderDirection: desc) {
      id
      orderId
      noteId
      author
      share
      encryptedContent
      createdAtBlock
      createdAtTx
    }
    noteOpenStates(where: { orderId: $orderId, user: $user }) {
      id
      orderId
      noteId
      user
      opened
      updatedAtBlock
      updatedAtTx
    }
  }
`;
