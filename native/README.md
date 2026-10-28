# Windows quota reader

`QuotaReader.exe` is the prebuilt .NET Framework 4.8 helper used by this plugin.
The MCP server invokes it only with `--check` and consumes its JSON output.

It delegates authenticated rate-limit reads to the locally installed Codex
app-server. If that request fails, it can use recent local quota records with
their original timestamps. It does not initiate a model turn.

The JavaScript server and UI are built from the repository's source. This
Windows helper is currently distributed as a prebuilt component; its source
is not included in this release.
