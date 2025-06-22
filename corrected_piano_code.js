// Set the tempo for the composition to a moderate and reflective pace (90 BPM).
setcpm(90);

// This composition creates a piano piece in C major, structured into three distinct layers:
// a foundational bass line, a rich chord progression, and a lyrical melody.
// All layers utilize the 'piano' sound for a realistic and expressive sound.
stack(
  // Layer 1: Bass Line
  // Plays the root notes of the C major (I), A minor (vi), F major (IV), and G major (V) chords.
  // Each note is sustained for the full duration of its corresponding chord (4 beats using @4).
  // The gain is set lower to provide a solid, yet subtle, foundation, and some room reverb
  // is added for a sense of space and depth.
  note("<c2@4 a2@4 f2@4 g2@4>")
    .sound("piano")
    .gain(0.6) // Slightly lower volume for the bass
    .room(0.3), // Moderate reverb for a spacious feel

  // Layer 2: Chord Progression
  // Provides the harmonic support with full voicings for C major, A minor, F major, and G major chords.
  // Each chord is also sustained for 4 beats (@4), perfectly aligning with the bass line.
  // The gain is balanced to ensure the chords are present and rich, complementing the bass
  // and providing a bed for the melody. Room reverb is consistent with the bass for cohesion.
  note("<[c3,e3,g3]@4 [a2,c3,e3]@4 [f2,a2,c3]@4 [g2,b2,d3]@4>")
    .sound("piano")
    .gain(0.7) // Balanced volume for chords
    .room(0.3), // Moderate reverb

  // Layer 3: Melody Line
  // A dynamic and flowing melody designed to weave above the chords.
  // Each sequence of 8 notes corresponds to the 4-beat duration of each chord,
  // effectively creating an eighth-note rhythm (two notes per beat), which adds movement.
  // The melody is given a higher gain to ensure it stands out as the primary voice,
  // with slightly less reverb to maintain clarity and presence.
  note("<e4 d4 c4 g3 e4 d4 c4 g3> <c4 b3 a3 e3 c4 b3 a3 e3> <a3 f3 c4 a3 f3 c4 a3 f3> <g3 d4 b3 g3 d4 b3 g3 d4>")
    .sound("piano")
    .gain(0.8) // Higher volume for melody prominence
    .room(0.2) // Less reverb for clarity
);
