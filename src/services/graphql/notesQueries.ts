// Queries for the notes subgraph

export const NOTES_BY_ORDER_QUERY = `
  query NotesByOrder($orderId: BigInt!, $user: Bytes!) {
    notes(where: { invoiceId: $orderId }, orderBy: noteId, orderDirection: desc) {
      id
      orderId: invoiceId
      noteId
      author
      share
      encryptedContent
      createdAtBlock
      createdAtTx
    }
    noteOpenStates(where: { invoiceId: $orderId, user: $user }) {
      id
      orderId: invoiceId
      noteId
      user
      opened
      updatedAtBlock
      updatedAtTx
    }
  }
`;
