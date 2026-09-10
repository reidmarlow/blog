---
title: "The Piano Decoder Was Already in the Chat Log"
description: "On 5 Sep an HN user asked if he can publish a PianoDisc decoder Fable wrote after reading a store MP3. The method is already in the thread."
pubDate: 2026-09-11T02:00:00+08:00
tags:
  - ai
  - agents
  - reverse-engineering
---

On 5 September 2026, jmpman posted [Ask HN: Fable hacked my piano, can I release the results?](https://news.ycombinator.com/item?id=49577129). When I opened it, the thread sat at 297 points and 164 comments.

He owns a self-playing piano on a PianoDisc Protigy system. He bought a store file of Erik Satie (he typed Eric Satre). He wanted to know if an LLM could make those files, so he ran Astra and Fable against each other for about an hour on Gymnopedie No 1. Then he asked Fable to grade a Mutopia MIDI. Then he handed it the store MP3.

The store files are MP3s. The left channel is accompaniment. The right channel carries MIDI as a 2004.5 Hz square wave. Fable named that, then wrote a Python encoder and a decoder. In the explanation it mentioned decoy notes. Extra events the PianoDisc player accepts, and a naive MIDI extract would choke on.

He asked HN if he can publish the decoder, the encoder, or both. He said he is in the US.

I am not going to reprint the codec. The HN post already names the carrier frequency and the decoy-note trick. That is enough. Commenters pointed at DMCA section 1201, at a store ToS line about circumventing security features, at ffmpeg as a project that already fights these fights, and at a simpler fact. Anyone with that thread and a store MP3 can ask another model to rebuild the code.

He asked about GitHub. The method was already in the agent log he pasted.

If you run coding agents on files you bought, the verbose explanation is the artifact. Fable offered the encoder. He said yes. It also wrote a decoder and named the obfuscation without being asked for a crack. One commenter guessed that when a model answers a question you did not ask, it is often regenerating a tool from training data. Maybe. You do not need that theory to act. The chat already contains a working description.

I would not email PianoDisc. Several comments said the company has no reason to bless this. I would also not treat HN as a bar exam. One useful split in the thread, from nerdsniper, was encoder versus decoder. Writing new files the player can load is a different act from stripping purchased tracks for other systems. Courts may ignore that split. I am not a lawyer, and I am not going to pretend the decoy notes are or are not an "effective technical measure."

What I would do on my own machines is narrower. Keep the store file. Keep the transcript in a private workspace. If I wanted other people to play public-domain Satie on a player piano, I would start from Mutopia and a documented MIDI-to-solenoid path, not from a purchased MP3. If I wanted interoperability notes, I would write the observed file layout without shipping a decoder that strips decoys.

Once the model dumps a format in chat, you have a reverse-engineering memo even if the repo stays private. Treat that log like source. Don't paste it onto HN if you are still deciding whether it should exist in public.
