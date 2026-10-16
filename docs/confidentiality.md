# Confidentiality

- **What leaves the computer:** nothing, except model downloads from huggingface.co and the token check during speaker setup.
- **What is stored:** projects (names, transcripts, edits, marks), models, an encrypted token, and an activity log that lists file names but never transcript text. See [Privacy](privacy-and-offline.md).
- **Exports contain text.** Minutes, quote list, highlights, original-vs-edited and anonymised exports all include transcript text.
- **Anonymised text** replaces speakers with P01, P02… and removes the speaker names you typed. It does not find other names spoken in the text.
- **Edited lines keep the original.** When you edit a line (or use Replace), the project keeps both the edited text and the original wording so the line can be put back. Both stay in the project file until you remove the project with the **×** in the sidebar.
- **No encryption of project files by the app.** Use your system's disk encryption for sensitive material.
- **Not audited.** The statements come from reading the code, not an independent security review.
- To remove a project: the **×** in the sidebar. To remove everything: quit and delete the data folder.
