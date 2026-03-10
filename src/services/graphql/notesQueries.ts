// Queries for the notes subgraph

export const NOTES_BY_ORDER_QUERY = `
  query NotesByOrder($invoiceId: BigInt!, $user: Bytes!) {
    notes(where: { invoiceId: $invoiceId }, orderBy: noteId, orderDirection: desc) {
      id
      invoiceId: invoiceId
      noteId
      author
      share
      encryptedContent
      createdAtBlock
      createdAtTx
    }
    noteOpenStates(where: { invoiceId: $invoiceId, user: $user }) {
      id
      invoiceId: invoiceId
      noteId
      user
      opened
      updatedAtBlock
      updatedAtTx
    }
  }
`;
