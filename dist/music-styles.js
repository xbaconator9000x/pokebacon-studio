export const MUSIC_SCALES={Major:[0,2,4,5,7,9,11],'Natural minor':[0,2,3,5,7,8,10],'Harmonic minor':[0,2,3,5,7,8,11],'Melodic minor':[0,2,3,5,7,9,11],Dorian:[0,2,3,5,7,9,10],Phrygian:[0,1,3,5,7,8,10],Lydian:[0,2,4,6,7,9,11],Mixolydian:[0,2,4,5,7,9,10],Locrian:[0,1,3,5,6,8,10],'Major pentatonic':[0,2,4,7,9],'Minor pentatonic':[0,3,5,7,10],'Major blues':[0,2,3,4,7,9],'Minor blues':[0,3,5,6,7,10],'Phrygian dominant':[0,1,4,5,7,8,10],'Double harmonic':[0,1,4,5,7,8,11],'Lydian dominant':[0,2,4,6,7,9,10],'Whole tone':[0,2,4,6,8,10],'Diminished half-whole':[0,1,3,4,6,7,9,10],Hirajoshi:[0,2,3,7,8],Insen:[0,1,5,7,10],'Hungarian minor':[0,2,3,6,7,8,11],Chromatic:[0,1,2,3,4,5,6,7,8,9,10,11]};
const style=(tempo,scale,progression,rhythm,bass,harmony,contour,description,extra={})=>({tempo,scale,progression,rhythm,bass,harmony,contour,description,...extra});
export const MUSIC_MOODS={
 Route:style(136,'Major',[0,3,1,4],'walking','walking','broken','arch','Bouncy two-bar hooks, walking bass and answering phrases.'),
 Gym:style(150,'Dorian',[0,3,5,4],'syncopated','octaves','pulse','rising','Anticipated accents, bass octaves, repeated challenges and firm cadences.'),
 Cave:style(80,'Harmonic minor',[0,5,1,4],'spacious','pedal','echo','falling','Long rests, a low pedal, delayed echoes and short descending calls.',{drums:.2,register:60}),
 Ocean:style(96,'Lydian',[0,1,3,0],'flowing','sustain','wave','arch','Rolling arpeggios, broad melody arcs and floating sustained bass.',{drums:.4}),
 Forest:style(112,'Dorian',[0,3,6,0],'lilt','alternating','broken','turn','Light offbeat steps, turning phrases and scattered answering figures.',{drums:.5}),
 Villain:style(120,'Phrygian dominant',[0,1,5,4],'march','pedal','ostinato','falling','A tight low ostinato, heavy march accents and descending threats.',{register:60}),
 Hero:style(132,'Major',[0,4,5,3],'anthem','octaves','pulse','rising','Wide opening calls answered by steps, strong bass and fanfare cadences.'),
 'Melancholy introduction':style(70,'Natural minor',[0,5,3,4],'ballad','sustain','broken','falling','A sparse opening, a lingering question and a gradually growing accompaniment.',{drums:.1,introBuild:true}),
 'Exciting introduction':style(164,'Mixolydian',[0,3,4,0],'driving','octaves','ostinato','rising','A pickup, climbing sequences, pulsing bass and fills into the loop.',{introBuild:true}),
 'In-game introduction':style(104,'Major',[0,3,1,4],'story','alternating','broken','arch','An establishing phrase, quiet middle and clear arrival into the groove.',{introBuild:true}),
 Spooky:style(88,'Phrygian',[0,1,0,4],'spacious','pedal','echo','turn','Separated calls, low pedals and offbeat echoes.',{drums:.3}),
 Exciting:style(156,'Major',[0,3,4,0],'driving','octaves','ostinato','rising','Driving pulse, rising hooks and short answering runs.'),
 Battle:style(168,'Natural minor',[0,5,3,4],'driving','octaves','ostinato','turn','A recurring battle hook, active bass and changing answers.'),
 Chill:style(88,'Major pentatonic',[0,3,1,4],'ballad','sustain','wave','arch','Loose phrases, open bass and gently rolling backing.',{drums:.4}),
 Angry:style(180,'Phrygian',[0,1,5,4],'driving','pedal','pulse','falling','Short tense phrases over a low, insistent rhythm.'),
 Intro:style(112,'Major',[0,3,4,0],'story','alternating','broken','rising','A gradual entrance leading to a clear repeating theme.',{introBuild:true}),
 Victory:style(144,'Major',[0,3,4,0],'anthem','octaves','pulse','rising','Fanfare calls, bright answers and an emphatic home cadence.'),
 Defeat:style(68,'Natural minor',[0,5,3,0],'ballad','sustain','echo','falling','Descending, spacious phrases with a subdued close.',{drums:.1}),
 Solemn:style(72,'Natural minor',[0,3,5,4],'ballad','sustain','broken','falling','Long melodic lines, restrained accompaniment and resolved endings.',{drums:.2})
};
export const MUSIC_GENRES={
 'Game soundtrack':{description:'Use the scene’s own arrangement vocabulary.'},
 Rock:{rhythm:'driving',bass:'octaves',harmony:'pulse',beat:'rock',gate:.82,description:'Backbeats, riff-like rhythms and pulsing accompaniment.'},
 Metal:{rhythm:'driving',bass:'chug',harmony:'ostinato',beat:'metal',gate:.65,description:'Tight chugs, rapid bass figures and clipped lead attacks.'},
 Orchestral:{rhythm:'anthem',bass:'sustain',harmony:'broken',beat:'orchestral',gate:.96,description:'Long melodic statements with rising accompaniment and swells.'},
 Jazz:{rhythm:'swing',bass:'walking',harmony:'comp',beat:'jazz',gate:.82,description:'Triplet swing, walking bass and syncopated comping.'},
 Funk:{rhythm:'syncopated',bass:'funk',harmony:'comp',beat:'funk',gate:.65,description:'Sixteenth-note anticipations, syncopated bass and short chords.'},
 Latin:{rhythm:'lilt',bass:'latin',harmony:'comp',beat:'latin',gate:.78,description:'Clave accents, anticipated bass and answering offbeat phrases.'},
 Electronic:{rhythm:'syncopated',bass:'pulse',harmony:'ostinato',beat:'electronic',gate:.73,description:'Four-beat pulse, repeating arpeggios and layered entries.'},
 Ambient:{rhythm:'spacious',bass:'sustain',harmony:'echo',beat:'none',gate:.98,description:'Breathing space, held bass and slow melodic answers.'},
 Folk:{rhythm:'walking',bass:'alternating',harmony:'broken',beat:'folk',gate:.88,description:'Singable questions and answers with alternating bass.'},
 Ballad:{rhythm:'ballad',bass:'sustain',harmony:'wave',beat:'ballad',gate:.97,description:'Held melody notes, broad arcs and soft rolling backing.'},
 March:{rhythm:'march',bass:'alternating',harmony:'pulse',beat:'march',gate:.78,description:'Strong two-beat accents, short calls and regular responses.'}
};
export function musicStyle(mood='Battle',genre='Game soundtrack'){if(!MUSIC_MOODS[mood]||!MUSIC_GENRES[genre])throw Error('Choose a scene style and genre.');const g=MUSIC_GENRES[genre],p=MUSIC_MOODS[mood];return{...p,...g,description:p.description+' '+g.description,beat:g.beat||p.rhythm,drums:g.beat==='none'?0:g.beat?1:p.drums??1,register:p.register||67,gate:g.gate||.9};}
