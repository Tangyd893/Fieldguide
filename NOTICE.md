# Third-Party Notices

Fieldguide incorporates code and design from the following open source projects.

---

## Understand-Anything

- **Repository**: https://github.com/Egonex-AI/Understand-Anything
- **License**: MIT License
- **Copyright**: Yuxiang Lin and Infinite Universe, Inc.
- **Usage in Fieldguide**: Code map indexing pipeline (`@understand-anything/core`), knowledge graph format (`.understand-anything/knowledge-graph.json`), and embedded Dashboard UI.

Fieldguide is a separate application that integrates Understand-Anything as an engine for codebase exploration. Fieldguide adds a desktop shell, multi-project library, academic paper learning, and concept bridging between papers and code.

---

## License (Fieldguide)

Fieldguide's own source code license will be declared in `LICENSE` when implementation begins.  
**Until then**: treat Fieldguide design documents as project-internal; upstream Understand-Anything remains MIT.

When shipping binaries:

1. Include this `NOTICE.md` (or equivalent section in About screen).
2. Retain Understand-Anything MIT license text if vendoring or redistributing UA components.
3. Pin UA version in release notes.
