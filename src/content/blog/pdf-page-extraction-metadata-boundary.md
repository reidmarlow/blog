---
title: "Extracting PDF Pages Is Not the Same as Making a Safe Copy"
description: "Use qpdf's empty input to assemble selected pages, then check the output for content that page selection and syntax checks cannot judge."
pubDate: 2026-11-17T06:20:00Z
tags:
  - pdf
  - security
  - tooling
  - webdev
---

A developer needs to send pages 3 and 6 of a customer-supplied PDF to a support engineer. Deleting the other pages from a viewer looks sufficient. But a PDF can carry document-level information as well as visible pages, and a page can itself contain information the recipient shouldn't receive.

The distinction matters when a script prepares diagnostic samples. The goal is not simply to produce a two-page file; it's to understand what the extraction retained and what a reviewer must still inspect.

## Choose the input deliberately

[qpdf's page-selection documentation](https://qpdf.readthedocs.io/en/stable/cli.html#page-selection) describes two approaches. A primary input supplies document-level information such as outlines and tags. With `--empty`, qpdf starts with an empty document and copies in the selected pages instead. Its examples say document-level metadata is discarded from the input files in this mode.

For a local file named `source.pdf`, select pages 3 and 6 like this:

```sh
qpdf --empty --pages source.pdf 3,6 -- excerpt.pdf
qpdf --show-npages excerpt.pdf
qpdf --check excerpt.pdf
```

The page count should be two. `--check` examines PDF structure and related encoding details; a clean result is not a content or confidentiality review. Open the output in a PDF viewer and check both pages, including headers, footers, annotations and any data visible in images. Confirm that the right version is being shared and that the recipient is authorized to receive it.

This example deliberately avoids using `source.pdf` as the primary document. With a command such as `qpdf source.pdf --pages . 3,6 -- excerpt.pdf`, qpdf documents that document-level information is taken from that primary input. That may be desirable when preserving a document's structure; it is a different choice from building an excerpt from an empty input.

## What page selection does not solve

`--empty` is useful for limiting document-level carryover, but it is not a general-purpose redaction tool. The selected pages can contain names in the text, account numbers in a screenshot, notes, or other content that remains part of the pages. Hiding text under a shape is not a substitute for a proper redaction process. For sensitive material, use an approved redaction workflow and inspect the exported result before sharing.

Also check whether the receiving workflow relies on document features such as outlines or tags. Starting with an empty document changes what is carried forward. A smaller file is not automatically an equivalent one, particularly for accessibility and navigation.

## Pick a workflow the next person can repeat

For automated processing, a command with explicit page numbers is easy to review and put in a script. Avoid putting sensitive source documents or generated excerpts into a public test fixture or build log. Use a synthetic PDF to test the command, then process real files only in the environment approved for them.

For an occasional manual excerpt, [KomoPDF](https://komopdf.com/) offers page organization and export in the browser. Its local editing workflow is useful when installing a command-line tool is impractical. The optional KolmoPDF translation step is separate: choosing it uploads the current PDF to that service. Page selection and an inspection of the exported file still matter regardless of the interface.

Disclosure: KomoPDF and KolmoPDF are associated with this publication. The qpdf example above is based on its documentation, not a comparative test of PDF tools.
