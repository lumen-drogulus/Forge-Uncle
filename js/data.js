// FORGE: PH-PPL program data
// ============================================
// Two parts (v0.34):
//   MOVES     every exercise once: name, how-to tip, demo video, logging mode.
//   workouts  each day lists moves by id with that day's sets, reps, RPE, rest
//             and size tier. Rest labels ("70 sec") are made from rest.
// To change a tip or video, edit MOVES: every day that uses the move follows.
// To change a day, edit its list. A day can override a move's tip with its
// own tip: field where the context differs (gym vs no gym).
// An id is the key for records and history: never rename one.

const MOVES = {

  // ----- first used on Push A -----
  "explosive-pushup": {
    name: "Explosive Push-Ups",
    weightMode: "bw",
    video: "https://www.youtube.com/watch?v=bCBFRCKjJME",
    tip: "Standard push-ups with maximum speed on the concentric. If you can clap, clap. If not, just press as explosively as possible. Power intent, not grinding reps.",
  },
  "bb-flat-bench": {
    name: "Barbell Flat Bench Press",
    weightMode: "free",
    video: "https://www.youtube.com/watch?v=rT7DgCr-3pg",
    tip: "Plant the feet, retract the shoulder blades, control the descent to chest, drive through the floor on the press. This is your primary strength marker for pressing. Track it religiously.",
  },
  "bb-overhead-press": {
    name: "Standing Barbell OHP",
    weightMode: "free",
    video: "https://www.youtube.com/watch?v=2yjwXTZQDDI",
    tip: "Brace the core hard before each rep. Slight lean back is fine, but the bar path should travel straight up over the crown of the head. No leg drive. Strict press.",
  },
  "incline-bb-press": {
    name: "Incline Barbell Press",
    weightMode: "free",
    video: "https://www.youtube.com/results?search_query=incline+barbell+bench+press+form",
    tip: "Bench at 30 degrees, not 45. Higher than that and it becomes a shoulder press with extra steps. Same setup as flat bench: shoulder blades pinned, feet planted, bar to the upper chest just below the collarbone.",
  },
  "weighted-dips-a": {
    name: "Dips",
    weightMode: "bw-plus",
    video: "https://www.youtube.com/watch?v=2z8JmcrW-As",
    tip: "Use a belt or hold a dumbbell between the feet. Slight forward lean to keep emphasis on chest and triceps. Full depth, elbows to roughly 90 degrees. If bodyweight dips aren't at 8+ clean reps yet, stay unweighted.",
  },
  "cg-bench-press": {
    name: "Close-Grip Bench Press",
    weightMode: "free",
    video: "https://www.youtube.com/watch?v=nEF0bv2FW94",
    tip: "Hands roughly shoulder width. Tuck the elbows slightly. This is both a tricep builder and a bench press accessory. Controlled descent, no bouncing.",
  },
  "incline-db-curl": {
    name: "Incline Dumbbell Curl",
    weightMode: "free",
    pair: true,
    video: "https://www.youtube.com/results?search_query=incline+dumbbell+curl+proper+form",
    tip: "Bench at about 60 degrees, head and shoulders back on the pad, arms hanging straight down behind the line of your body. Curl without letting the elbows swing forward, then lower for three counts to a full hang. The stretch at the bottom is the point, so go lighter than your standing curl.",
  },
  "db-lateral-raise": {
    name: "Dumbbell Lateral Raises",
    weightMode: "free",
    pair: true,
    video: "https://www.youtube.com/watch?v=3VcKaXpzqRo",
    tip: "Slight forward lean, thumbs tilted slightly down (like pouring water). Controlled up, slow down. Don't ego-lift these. Feel the burn at rep 10, fight for 15.",
  },
  "back-extension": {
    name: "Back Extension",
    weightMode: "free",
    video: "https://www.youtube.com/results?search_query=45+degree+back+extension+proper+form",
    tip: "Log 0 until bodyweight is easy for 3 sets of 15, then hold a plate to the chest. Hinge at the hips, not the spine. Rise until the body is a straight line and STOP. Hyperextending past that is how you turn a prehab exercise into the thing that hurt you.",
  },
  "reverse-crunch": {
    name: "Reverse Crunch",
    weightMode: "bw",
    video: "https://www.youtube.com/results?search_query=reverse+crunch+proper+form",
    tip: "Lie on a bench or the floor, hands gripping the bench behind your head or flat beside your hips, knees bent to 90. Curl the pelvis up off the pad until the knees come toward the chest, then lower for three counts. The lift comes from the abs rolling the hips, not from swinging the legs. Head and neck stay down and relaxed.",
  },
  "supine-neck-flexion": {
    name: "Supine Neck Flexion",
    weightMode: "free",
    video: "https://www.youtube.com/results?search_query=lying+weighted+neck+flexion+tutorial",
    tip: "Lie face-up with the head off the end of the bench, shoulders on the pad. Chin tucks toward the chest, three counts on the way back. Log 0 until bodyweight is 3 sets of 20. Then a 5 lb plate wrapped in a towel on the forehead, back down to 8-10 reps, build to 20, then 10 lbs. Any sharp pain or tingling, stop the set.",
  },

  // ----- first used on Pull A -----
  "bb-bent-row": {
    name: "Barbell Bent-Over Row",
    weightMode: "free",
    video: "https://www.youtube.com/watch?v=FWJR5Ve8bnQ",
    tip: "Hinge at the hips, torso at roughly 45 degrees, pull the bar to the lower chest. A small amount of body english is fine on the last rep or two, but this should be mostly strict. Squeeze the shoulder blades at the top.",
  },
  "weighted-pullup": {
    name: "Pull-Ups",
    weightMode: "bw-plus",
    video: "https://www.youtube.com/watch?v=eGo4IYlbE5g",
    tip: "Full dead hang at the bottom, chin over bar at the top. Use a belt for added weight. If bodyweight pull-ups aren't solid at 6+ reps yet, do heavy lat pulldowns at the same rep scheme instead.",
  },
  "chest-supported-row": {
    name: "Chest-Supported Row",
    weightMode: "free",
    pair: true,
    video: "https://www.youtube.com/results?search_query=chest+supported+row+form",
    tip: "Chest pinned to the pad, which takes the lower back out entirely. That is the point: all the pulling volume, none of the spinal load you already paid for on bent-over rows. Pull to the lower ribs, squeeze, control back.",
  },
  "bb-shrugs": {
    name: "Barbell Shrugs",
    weightMode: "free",
    video: "https://www.youtube.com/watch?v=cJRVVxmytaM",
    tip: "Heavy. Hold at the top for a one-count. Straight up and down, no rolling the shoulders.",
  },
  "bb-curls": {
    name: "Barbell Curls",
    weightMode: "free",
    video: "https://www.youtube.com/watch?v=kwG2ipFRgFo",
    tip: "Strict. If the torso is swaying, the weight is too heavy. Curls on power day are heavier and lower rep than most people do them. Treat them like a real lift.",
  },
  "preacher-curl": {
    name: "Preacher Curl",
    weightMode: "free",
    video: "https://www.youtube.com/results?search_query=preacher+curl+proper+form",
    tip: "Armpits into the top of the pad. Do not let the elbows drift down the slope. Full extension at the bottom, which is the whole reason to use this over standing curls, so resist the urge to cut the range short.",
  },
  "ez-skull-crusher": {
    name: "EZ-Bar Skull Crusher",
    weightMode: "free",
    video: "https://www.youtube.com/results?search_query=ez+bar+skull+crusher+proper+form",
    tip: "Flat bench, EZ bar on the inner bends, arms tilted slightly back toward your head. Bend only at the elbows and lower the bar just past the top of your head, then press back up. Elbows stay pointed at the ceiling, not flared. Log the plates plus the bar.",
  },
  "rear-delt-flyes": {
    name: "Rear Delt Flyes",
    weightMode: "free",
    pair: true,
    video: "https://www.youtube.com/watch?v=EA7u4Q_8HQ0",
    tip: "Bent over, slight elbow bend, raise out to sides with a squeeze at top. Light weight, high control. Balances all the pressing in this program.",
  },
  "hanging-leg-raise": {
    name: "Hanging Leg Raise",
    weightMode: "bw",
    video: "https://www.youtube.com/results?search_query=hanging+leg+raise+proper+form",
    tip: "Start with knees tucked if straight legs make you swing. The goal is curling the pelvis up at the top, not just lifting the legs. No swinging. If you are using momentum, drop to bent knees and rebuild it.",
  },
  "prone-neck-extension": {
    name: "Prone Neck Extension",
    weightMode: "free",
    video: "https://www.youtube.com/results?search_query=lying+weighted+neck+extension+tutorial",
    tip: "Face-down, head off the end of the bench. Look up slowly, lower for three counts. Log 0 until bodyweight is 3 sets of 20. Then a 5 lb plate wrapped in a towel on the back of the head, back down to 8-10 reps, build to 20, then 10 lbs. Pairs with neck flexion on the push days so the neck gets balanced work front and back. Sharp pain or tingling means stop, not push through.",
  },
  "dead-hang": {
    name: "Dead Hangs",
    weightMode: "bw",
    trackMode: "time",
    video: "https://www.youtube.com/watch?v=wPmGMqaKhJo",
    tip: "Full grip, shoulders engaged (not shrugging up to the ears). Track your times. When consistently over 60 seconds, start adding scapular pulls from the hang for sets of 8-10.",
  },

  // ----- first used on Legs A -----
  "kb-swings": {
    name: "Kettlebell Swings",
    weightMode: "free",
    video: "https://www.youtube.com/results?search_query=kettlebell+swing+hip+hinge+tutorial",
    tip: "Hip hinge, not a squat. The bell is thrown forward by the hips snapping, arms are just rope. Bell floats to chest height, no higher. Done right you will feel this in the glutes and hamstrings, which is exactly what you want awake before heavy squats.",
  },
  "bb-back-squat": {
    name: "Barbell Back Squat",
    weightMode: "free",
    video: "https://www.youtube.com/watch?v=ultWZbUMPL8",
    tip: "Primary lower body strength marker. Full depth (hip crease at or below knee level). Brace hard before each rep. Controlled descent, powerful drive out of the hole. Feet roughly shoulder width, toes pointed slightly out.",
  },
  "romanian-deadlift": {
    name: "Romanian Deadlift",
    weightMode: "free",
    video: "https://www.youtube.com/watch?v=7j-2w4-P14I",
    tip: "Bar stays close to the legs. Push the hips back until you feel a strong stretch in the hamstrings, then drive the hips forward to stand. This is a hinge, not a squat. Slight knee bend that doesn't change throughout the rep.",
  },
  "leg-press": {
    name: "Leg Press",
    weightMode: "free",
    video: "https://www.youtube.com/watch?v=IZxyjW7MPJQ",
    tip: "Feet high and wide for more glute and hamstring emphasis, or centered for quad emphasis. Full range of motion, knees tracking over toes. Don't lock out at the top.",
  },
  "seated-leg-curl": {
    name: "Seated Leg Curl",
    weightMode: "free",
    video: "https://www.youtube.com/results?search_query=seated+leg+curl+proper+form",
    tip: "Back flat against the pad, thigh pad snug just above the knees, roller on the lower calf. Curl all the way under the seat, then let it back up for three counts to nearly straight. Staying upright or leaning slightly forward keeps the hamstrings stretched, which is why this beats lying down.",
  },
  "hip-adduction": {
    name: "Hip Adduction Machine",
    weightMode: "free",
    video: "https://www.youtube.com/results?search_query=hip+adduction+machine+proper+form",
    tip: "The squeeze-in machine, not the push-out one. Set the pads as wide as is comfortable, squeeze the knees together, pause a beat, and let them open slowly. Start light: the inner thigh strains easily when it isn't used to direct work.",
  },
  "standing-calf-raise": {
    name: "Weighted Standing Calf Raises",
    weightMode: "free",
    video: "https://www.youtube.com/watch?v=YMVhHmKSsqI",
    tip: "Load this heavy. Full stretch at the bottom (let the heels drop), hard squeeze at the top with a two-count hold. Calves respond to heavy loads and full range. Don't bounce.",
  },
  "farmer-carry": {
    name: "Farmer Carry",
    weightMode: "free",
    pair: true,
    video: "https://www.youtube.com/results?search_query=farmer+carry+proper+form",
    tip: "Log the weight in ONE hand. Heavy dumbbells or handles, ribs down, shoulders back, walk tall and controlled. Grip usually quits first, which is the training effect. Nothing after this needs your grip, so empty the tank.",
  },
  "pallof-press": {
    name: "Pallof Press",
    weightMode: "free",
    video: "https://www.youtube.com/results?search_query=pallof+press+form",
    tip: "Cable or band at chest height, stand side-on, press straight out and resist the rotation. Nothing moves except your arms. Log the reps for one side, then match them on the other. This is anti-rotation work, which is the half of core training almost everyone skips.",
  },
  "side-neck-raise": {
    name: "Side Neck Raise",
    weightMode: "free",
    video: "https://www.youtube.com/results?search_query=side+lying+neck+lateral+flexion+bench",
    tip: "Lie on your side on a bench, bottom shoulder on the pad, head off the end. Let the ear sink toward the floor, then raise it toward the top shoulder. The shoulders do not move. Log 0 until bodyweight is 20 clean reps with a three-count lowering, then hold a 5 lb plate in a towel against the temple and drop back to 8. Do both sides and log the reps for one. Sharp pain or tingling, stop the set.",
  },

  // ----- first used on Push B -----
  "pike-pushup": {
    name: "Pike Push-Ups",
    weightMode: "bw",
    video: "https://www.youtube.com/watch?v=sposDXWEB0A",
    tip: "Hips high, head between the arms, pressing vertically. Entry point toward handstand push-ups. If too hard, elevate feet on a bench to reduce load. Track rep counts. When hitting 15+ on both sets, elevate feet higher.",
  },
  "db-incline-press": {
    name: "Dumbbell Incline Press",
    weightMode: "free",
    pair: true,
    video: "https://www.youtube.com/watch?v=8iPEnn-ltC8",
    tip: "Set bench to 30-degree incline. Three-count descent on every rep. Squeeze at the top without clanking the dumbbells together. Shifts emphasis to upper chest and front delts.",
  },
  "cable-flyes": {
    name: "Cable Flyes",
    weightMode: "free",
    video: "https://www.youtube.com/watch?v=Iwe6AmxVf7o",
    tip: "Slight bend in the elbows, maintained throughout. Think hugging motion. Squeeze for a one-count at peak contraction. Light enough to feel the muscle, heavy enough that 15 is actually hard.",
  },
  "tricep-pushdown": {
    name: "Tricep Pushdowns",
    weightMode: "free",
    video: "https://www.youtube.com/watch?v=2-LAMcpzODU",
    tip: "Elbows pinned to the sides. Full extension at the bottom, controlled return. Two different tricep angles in one session gives balanced development across all three heads.",
  },
  "cable-oh-tricep-ext": {
    name: "Overhead Tricep Extension",
    weightMode: "free",
    video: "https://www.youtube.com/watch?v=kiuVA0gs3EI",
    tip: "Face away from cable stack, rope behind the head. Extend fully overhead, squeeze at lockout. The long head of the tricep gets stretched in this position, which is important since flat pressing doesn't load it well.",
  },
  "cable-curl-behind": {
    name: "Behind-the-Body Cable Curl",
    weightMode: "free",
    video: "https://www.youtube.com/results?search_query=bayesian+cable+curl+proper+form",
    tip: "Pulley at the bottom, single handle. Face away from the stack and step forward until your arm is pulled back behind your body. Curl without letting the elbow drift forward, lower slowly to a full stretch. One arm at a time. Log the reps for one side.",
  },
  "ez-reverse-curl": {
    name: "EZ-Bar Reverse Curl",
    weightMode: "free",
    video: "https://www.youtube.com/results?search_query=ez+bar+reverse+curl+proper+form",
    tip: "Palms down on the outer bends of the EZ bar, thumbs over the top. Elbows pinned to your sides, curl to shoulder height, lower for three counts. Wrists stay straight. Expect about half your normal curl weight: the forearms are the limit here.",
  },
  "crunch-machine": {
    name: "Crunch Machine",
    weightMode: "free",
    video: "https://www.youtube.com/results?search_query=ab+crunch+machine+proper+form",
    tip: "Set the seat so the pivot sits at your navel, not your chest. Short range, controlled, no yanking with the arms. Two-second squeeze at the bottom of the crunch.",
  },

  // ----- first used on Pull B -----
  "inverted-row": {
    name: "Inverted Rows",
    weightMode: "bw",
    video: "https://www.youtube.com/watch?v=dYNdjKjMbyc",
    tip: "Bar in rack at waist height. Hang underneath, body straight, pull chest to bar. More horizontal = harder. Start at an angle that allows 8+ reps. When horizontal at 15+, add a weighted vest or elevate feet.",
  },
  "seated-cable-row": {
    name: "Seated Cable Row",
    weightMode: "free",
    video: "https://www.youtube.com/watch?v=GZbfZ033f74",
    tip: "Sit upright, pull handle to lower chest, squeeze shoulder blades for a one-count. Three-count return on every rep. Pull with the elbows, not the hands.",
  },
  "wide-lat-pulldown": {
    name: "Wide-Grip Lat Pulldown",
    weightMode: "free",
    video: "https://www.youtube.com/watch?v=CAwf7n6Luuc",
    tip: "Pull to upper chest, not behind neck. Lean back slightly. Drive elbows down toward hips. Slow negative on every rep. Complements heavy pull-ups on power day through different grip width and angle.",
  },
  "face-pulls": {
    name: "Face Pulls",
    weightMode: "free",
    video: "https://www.youtube.com/watch?v=rep-qVOkqgk",
    tip: "Cable at face height. Pull toward face with elbows high, externally rotating so hands finish beside ears. Non-negotiable shoulder health work. Rear delts and rotator cuff muscles that keep shoulders functioning through all the pressing.",
  },
  "db-shrugs": {
    name: "Dumbbell Shrugs",
    weightMode: "free",
    pair: true,
    video: "https://www.youtube.com/results?search_query=dumbbell+shrug+proper+form+traps",
    tip: "Dumbbells at the sides means no bar blocking the bottom, so you get a real stretch before the shrug. Straight up, pause a beat at the top, lower slowly. No rolling the shoulders, which does nothing but grind the joint.",
  },
  "db-hammer-curls": {
    name: "Dumbbell Hammer Curls",
    weightMode: "free",
    pair: true,
    video: "https://www.youtube.com/watch?v=zC3nLlEvin4",
    tip: "Neutral grip (palms facing each other). Alternating or simultaneous. Controlled, no swinging. Hits brachialis and brachioradialis for arm thickness and forearm development.",
  },
  "wrist-curl": {
    name: "Wrist Curl",
    weightMode: "free",
    video: "https://www.youtube.com/results?search_query=seated+barbell+wrist+curl+proper+form",
    tip: "Sit, forearms flat on your thighs, palms up, wrists just past the knees. Let the bar roll down to your fingertips, then close the hand and curl the wrist up. Only the wrists move. Late in the day on purpose: your grip is done after this.",
  },

  // ----- first used on Legs B -----
  "assisted-pistol-squat": {
    name: "Assisted Pistol Squats",
    weightMode: "bw",
    video: "https://www.youtube.com/watch?v=qDcniqddTeE",
    tip: "Hold a rack post or TRX for balance. Lower on one leg to bench, touch glutes to surface, stand up. Use as much assistance as needed. Progressively lower box height and reduce hold over weeks. When you can pistol to a standard bench unassisted for 5+ reps per leg, the box comes away.",
  },
  "bulgarian-split-squat": {
    name: "Bulgarian Split Squats",
    weightMode: "free",
    pair: true,
    video: "https://www.youtube.com/watch?v=2C-uNgKwPLE",
    tip: "Rear foot on bench. Dumbbells at sides. Drop back knee straight down, drive through front heel. Unilateral work exposes and fixes imbalances bilateral squats hide. Rest between legs, not between sets.",
  },
  "lying-leg-curl": {
    name: "Lying Leg Curl",
    weightMode: "free",
    video: "https://www.youtube.com/watch?v=1Tq3QdYUuHs",
    tip: "Squeeze hard at peak contraction, three-count negative on every rep. Don't let hips lift off the pad. RDL on power day loads hamstrings stretched; leg curl loads them shortened. You need both.",
  },
  "leg-extension": {
    name: "Leg Extension",
    weightMode: "free",
    video: "https://www.youtube.com/watch?v=YyvSfVjQeL0",
    tip: "Full extension at top with one-count squeeze. Slow negative. Quads in isolation. Complements squat and split squat patterns.",
  },
  "hip-abduction": {
    name: "Hip Abduction Machine",
    weightMode: "free",
    video: "https://www.youtube.com/results?search_query=hip+abduction+machine+glute+medius+form",
    tip: "Lean the torso slightly forward to bias the glute medius over the TFL. Push out under control, resist all the way back in. Weak abductors are a common source of knee and lower back complaints, so treat this as real work, not a cooldown.",
  },
  "walking-lunges": {
    name: "Walking Lunges",
    weightMode: "free",
    pair: true,
    video: "https://www.youtube.com/watch?v=L8fvypPrzzs",
    tip: "Dumbbells at sides. Long stride, upright torso, back knee kisses floor. High-fatigue by design after split squats, curls, and extensions. Moderate weight, quality steps.",
  },
  "hip-thrust": {
    name: "Hip Thrust Machine",
    weightMode: "free",
    video: "https://www.youtube.com/results?search_query=hip+thrust+machine+proper+form",
    tip: "Upper back on the pad, belt or pad across the hip crease, feet flat so the shins are vertical at the top. Drive through the heels until the hips are level with the knees, squeeze for a beat, lower under control. Chin tucked and ribs down: the movement is at the hips, not the lower back.",
  },
  "seated-calf-raise": {
    name: "Seated Calf Raises",
    weightMode: "free",
    video: "https://www.youtube.com/watch?v=JbyjNymZOt0",
    tip: "Full stretch at bottom, hard squeeze at top. Seated raises emphasize the soleus (deeper calf muscle underneath the gastrocnemius). Standing raises on power day hit the gastroc. Both days, both muscles.",
  },
  "suitcase-carry": {
    name: "Suitcase Carry",
    weightMode: "free",
    video: "https://www.youtube.com/results?search_query=suitcase+carry+core+exercise+form",
    tip: "One weight, one side, walk without leaning. The obliques on the empty side are doing the work, fighting to keep you upright. This is direct anti-tilt training for the same lower back the back extensions are protecting. Switch hands each set.",
  },

  // ----- first used on Calisthenics Push -----
  "pushup": {
    name: "Push-Ups",
    weightMode: "bw",
    video: "https://www.youtube.com/results?search_query=push+up+proper+form",
    tip: "Hands under the shoulders, body in one line from heel to head. Elbows about 45 degrees from the ribs, not flared to 90. Too easy? Elevate the feet. Too hard? Hands on a bench.",
  },
  "bench-dip": {
    name: "Bench or Bar Dips",
    weightMode: "bw",
    video: "https://www.youtube.com/results?search_query=parallel+bar+dips+form",
    tip: "Parallel bars if the park has them, a bench edge if not. Lean forward slightly for more chest, stay upright for more triceps. Stop when the upper arms hit parallel, going deeper wrecks shoulders.",
  },
  "diamond-pushup": {
    name: "Diamond Push-Ups",
    weightMode: "bw",
    video: "https://www.youtube.com/results?search_query=diamond+push+up+form",
    tip: "Index fingers and thumbs touching under the sternum. This is your triceps work without a cable stack. Keep the elbows tucked tight to the body the whole way down.",
  },
  "archer-pushup": {
    name: "Archer Push-Ups",
    weightMode: "bw",
    video: "https://www.youtube.com/results?search_query=archer+push+up+tutorial",
    tip: "Wide hands, shift onto one side as you lower, the other arm stays straight. The bridge to one-arm push-ups. Go slow, the straight arm wants to collapse.",
  },
  "superman": {
    name: "Superman Hold",
    weightMode: "bw",
    trackMode: "time",
    video: "https://www.youtube.com/results?search_query=superman+exercise+lower+back",
    tip: "Face down, lift chest and thighs off the floor together. This is the back extension substitute when there is no bench. Squeeze the glutes, do not crank the neck up, keep the gaze at the floor.",
  },
  "hollow-hold": {
    name: "Hollow Body Hold",
    weightMode: "bw",
    trackMode: "time",
    video: "https://www.youtube.com/results?search_query=hollow+body+hold+tutorial",
    tip: "Lower back pressed flat into the floor, shoulders and legs raised. If the back arches, raise the legs higher until it does not. The hardest easy exercise in gymnastics.",
  },
  "neck-isometrics": {
    name: "Neck Isometrics",
    weightMode: "bw",
    video: "https://www.youtube.com/results?search_query=neck+isometric+exercises+for+neck+pain",
    tip: "Palm on the forehead, push the head into it without the head moving. Hold 10 seconds. Repeat on the back and each side. No load, no motion, no momentum.",
  },

  // ----- first used on Calisthenics Pull -----
  "pullup-bw": {
    name: "BW Pull-Ups",
    weightMode: "bw",
    video: "https://www.youtube.com/results?search_query=strict+pull+up+form",
    tip: "Bodyweight version. Full hang at the bottom, chin clears the bar at the top, no kipping. Can't get the reps? Jump to the top and lower yourself as slowly as possible, which builds the strength faster than band assistance.",
  },
  "chinup-bw": {
    name: "Chin-Ups",
    weightMode: "bw",
    video: "https://www.youtube.com/results?search_query=chin+up+proper+form",
    tip: "Palms toward you, hands shoulder width. More biceps than a pull-up, which is the point on a day with no curls available.",
  },

  // ----- first used on Calisthenics Legs -----
  "broad-jump": {
    name: "Broad Jumps",
    weightMode: "bw",
    video: "https://www.youtube.com/results?search_query=broad+jump+technique",
    tip: "Swing the arms, jump forward for distance, land soft with bent knees. Replaces box jumps: same hip power, nothing to trip over. Reset fully between reps, this is a power exercise not conditioning.",
  },
  "bw-squat": {
    name: "Bodyweight Squats",
    weightMode: "bw",
    video: "https://www.youtube.com/results?search_query=bodyweight+squat+form",
    tip: "Feet shoulder width, sit back and down, knees tracking over the toes. If 30 is easy, slow the descent to a five count. Tempo turns an easy movement into real work without adding load.",
  },
  "single-leg-rdl": {
    name: "Single-Leg RDL",
    weightMode: "bw",
    video: "https://www.youtube.com/results?search_query=single+leg+romanian+deadlift+bodyweight",
    tip: "Hinge at the hip, back leg extends behind as a counterweight, spine stays long. Balance is part of the exercise. This is your hamstring and lower back work when there is no barbell.",
  },
  "bw-lunge": {
    name: "Walking Lunges",
    weightMode: "bw",
    video: "https://www.youtube.com/results?search_query=bodyweight+walking+lunge+form",
    tip: "Long step, back knee toward the floor, front shin close to vertical. Bodyweight version, so chase reps and control rather than load.",
  },
  "step-up": {
    name: "Step-Ups",
    weightMode: "bw",
    video: "https://www.youtube.com/results?search_query=step+up+exercise+form",
    tip: "Bench, box, or a park wall about knee height. Drive through the heel of the top foot, do not push off the trailing leg. Control the way down.",
  },
  "glute-bridge": {
    name: "Single-Leg Glute Bridge",
    weightMode: "bw",
    video: "https://www.youtube.com/results?search_query=single+leg+glute+bridge+form",
    tip: "One foot planted, other leg extended. Drive through the heel, squeeze at the top for a beat, lower under control. Ribs down so the lower back does not take over the movement.",
  },
  "bw-calf-raise": {
    name: "Single-Leg Calf Raise",
    weightMode: "bw",
    video: "https://www.youtube.com/results?search_query=single+leg+calf+raise+form",
    tip: "One leg, off a step or curb if you have one, full stretch at the bottom and a hard squeeze at the top. Bodyweight on one leg is roughly what two legs loaded would give you.",
  },
  "wall-sit": {
    name: "Wall Sit",
    weightMode: "bw",
    trackMode: "time",
    video: "https://www.youtube.com/results?search_query=wall+sit+proper+form",
    tip: "Back flat to the wall, thighs parallel to the floor, no hands on the knees. Track the time. Pure quad endurance, and it burns in a way that squats do not.",
  },

  // ----- first used on Calisthenics Full Body -----
  "burpee": {
    name: "Burpees",
    weightMode: "bw",
    video: "https://www.youtube.com/results?search_query=burpee+proper+form",
    tip: "Chest to the floor, full stand at the top. Pace yourself, this is the conditioning piece. Skip the jump if the knees complain.",
  },

  // ----- first used on Back & Core -----
  "dead-bug": {
    name: "Dead Bug",
    weightMode: "bw",
    video: "https://www.youtube.com/results?search_query=dead+bug+exercise+form",
    tip: "On your back, opposite arm and leg extend while the lower back stays glued to the floor. Slow. If the back lifts, shorten the range. Teaches the bracing that protects your spine under load.",
  },
  "bird-dog": {
    name: "Bird Dog",
    weightMode: "bw",
    video: "https://www.youtube.com/results?search_query=bird+dog+exercise+form",
    tip: "Hands and knees, opposite arm and leg extend to a straight line and hold two seconds. Hips stay square to the floor. Direct spinal stabilizer work, which is why it pairs with the back extensions.",
  },
  "decline-plate-crunch": {
    name: "Decline Plate Crunch",
    weightMode: "free",
    video: "https://www.youtube.com/results?search_query=decline+weighted+crunch+proper+form",
    tip: "Feet hooked on a decline bench, plate hugged flat to the chest, never behind the head. Curl the ribs toward the pelvis, pause, lower for three counts and stop short of lying flat so the abs stay loaded. Log the plate's weight; log 0 until bodyweight is easy for 3 sets of 15. Eyes on the ceiling so the neck stays out of it.",
  },
};

const FORGE_DATA = {
  programName: "PH-PPL",
  // Sheets addresses live in js/config.js (v0.22), so copies differ by one file.
  sheetsWebhookUrl: (typeof FORGE_CONFIG !== 'undefined' && FORGE_CONFIG.sheetsWebhookUrl) || '',
  sheetsViewUrl: (typeof FORGE_CONFIG !== 'undefined' && FORGE_CONFIG.sheetsViewUrl) || '',
  // Six training slots. Rest is NO LONGER a cycle position: it is a calendar
  // marker only, so marking a rest day never costs you a workout. "code" is
  // what the calendar prints: P/B/L for push/back/legs, 1/2 for the power and
  // hypertrophy variants. C is reserved for the Back & Core alternate.
  cycleDays: [
    { id: "push-a", name: "Push A", type: "power", label: "Power", color: "amber", code: "P1" },
    { id: "pull-a", name: "Pull A", type: "power", label: "Power", color: "amber", code: "B1" },
    { id: "legs-a", name: "Legs A", type: "power", label: "Power", color: "amber", code: "L1" },
    { id: "push-b", name: "Push B", type: "hypertrophy", label: "Hypertrophy", color: "cyan", code: "P2" },
    { id: "pull-b", name: "Pull B", type: "hypertrophy", label: "Hypertrophy", color: "cyan", code: "B2" },
    { id: "legs-b", name: "Legs B", type: "hypertrophy", label: "Hypertrophy", color: "cyan", code: "L2" }
  ],

  // Alternate days: calisthenics (no gym) and Back & Core (a bonus by default).
  alternates: {
    "cal-push": { id: "cal-push", name: "Calisthenics Push", type: "calisthenics", label: "Bodyweight", color: "green", code: "CP", advancesByDefault: true },
    "cal-pull": { id: "cal-pull", name: "Calisthenics Pull", type: "calisthenics", label: "Bodyweight", color: "green", code: "CB", advancesByDefault: true },
    "cal-legs": { id: "cal-legs", name: "Calisthenics Legs", type: "calisthenics", label: "Bodyweight", color: "green", code: "CL", advancesByDefault: true },
    "cal-full": { id: "cal-full", name: "Calisthenics Full Body", type: "calisthenics", label: "Bodyweight", color: "green", code: "CF", advancesByDefault: true },
    "back-core": { id: "back-core", name: "Back & Core", type: "power", label: "Posterior & Core", color: "violet", code: "C", advancesByDefault: false }
  },

  // Cable attachment for each cable move, by exercise id (v0.30). Shown on the Tips sheet
  // under the figure. kind picks the icon and name in app.js (ATTACHMENTS); count 2 = one each side.
  attachments: {
    "tricep-pushdown":     { kind: "rope", why: "Split the ends past your thighs at the bottom for a full lockout. A short straight bar lets you go heavier if the rope stalls." },
    "cable-oh-tricep-ext": { kind: "rope", why: "The ends pass either side of your head and split at lockout. A bar would hit you on the way down." },
    "face-pulls":          { kind: "rope", why: "The only attachment that lets your hands split past your ears." },
    "wide-lat-pulldown":   { kind: "lat-bar", why: "The long bar with bent ends. Hands just outside the bends." },
    "seated-cable-row":    { kind: "neutral-bar", why: "The medium one, hands about shoulder width, palms facing each other. Lets the elbows drive back past the ribs. A V-handle works if it's taken." },
    "cable-flyes":         { kind: "d-handle", count: 2, why: "One on each side, pulleys at chest height." },
    "pallof-press":        { kind: "d-handle", why: "One handle, both hands wrapped around it, pulley at chest height." },
    "cable-curl-behind":   { kind: "d-handle", why: "One handle, pulley at the bottom. Train one arm, then the other." },
  },

  workouts: {
    "push-a": {
      id: "push-a", name: "Push A", type: "power", label: "Power",
      goal: "Strength — heavy compounds, low reps, long rest",
      minutesBySize: { light: 64, normal: 90, extended: 109 },
      warmup: {
        name: "Dynamic Warm-Up",
        duration: "5 minutes",
        movements: [
          { name: "Arm Circles", fig: "arm-circles", text: "Arm circles, 10 forward and 10 back" },
          { name: "Band Pull-Aparts", fig: "band-pull-apart", text: "Band pull-aparts, 15 reps with a light band, squeezing shoulder blades" },
          { name: "Push-Up Walkouts", fig: "pushup-walkout", text: "Push-up walkouts, 5 reps, walking hands out slowly into full push-up position" },
          { name: "Light Bench Press", fig: "bb-flat-bench", text: "Empty bar or light dumbbell bench press, 10-12 easy reps to groove the pattern" }
        ]
      },
      exercises: [
        ["explosive-pushup", { tier: 1, sets: 2, reps: "to failure", rpe: "-", rest: 45, isPrimer: true, finisherProgression: "Building toward handstand push-ups. Explosive push-ups develop pressing power." }],
        ["bb-flat-bench", { tier: 1, sets: 4, reps: "5", rpe: "7-8", rest: 70 }],
        ["bb-overhead-press", { tier: 1, sets: 4, reps: "5", rpe: "7-8", rest: 70 }],
        ["incline-bb-press", { tier: 2, sets: 3, reps: "6-8", rpe: "8", rest: 60 }],
        ["weighted-dips-a", { tier: 1, sets: 3, reps: "6-8", rpe: "8", rest: 60 }],
        ["cg-bench-press", { tier: 1, sets: 3, reps: "8", rpe: "8", rest: 60 }],
        ["incline-db-curl", { tier: 3, sets: 3, reps: "10-12", rpe: "9", rest: 45 }],
        ["db-lateral-raise", { tier: 3, sets: 3, reps: "12-15", rpe: "8-9", rest: 45 }],
        ["back-extension", { tier: 1, sets: 3, reps: "12-15", rpe: "7-8", rest: 45 }],
        ["reverse-crunch", { tier: 2, sets: 3, reps: "12-15", rpe: "8-9", rest: 45 }],
        ["supine-neck-flexion", { tier: 1, sets: 3, reps: "8-20", rpe: "7", rest: 45 }]
      ]
    },
    "pull-a": {
      id: "pull-a", name: "Pull A", type: "power", label: "Power",
      goal: "Strength — heavy compounds, low reps, long rest",
      minutesBySize: { light: 62, normal: 87, extended: 106 },
      warmup: {
        name: "Dynamic Warm-Up",
        duration: "5 minutes",
        movements: [
          { name: "Band Pull-Aparts", fig: "band-pull-apart", text: "Band pull-aparts, 15 reps" },
          { name: "Cat-Cow", fig: "cat-cow", text: "Cat-cow stretches, 8 slow reps through full spinal range" },
          { name: "Thoracic Rotations", fig: "thoracic-rotation", text: "Thoracic rotations from half-kneeling, 8 each side" },
          { name: "Light Pulldowns or Rows", fig: ["wide-lat-pulldown","db-row"], text: "Light lat pulldowns or light dumbbell rows, 10 reps to wake up the lats" }
        ]
      },
      exercises: [
        ["bb-bent-row", { tier: 1, sets: 4, reps: "5", rpe: "7-8", rest: 70 }],
        ["weighted-pullup", { tier: 1, sets: 4, reps: "5-6", rpe: "8", rest: 70 }],
        ["chest-supported-row", { tier: 1, sets: 3, reps: "10", rpe: "8", rest: 60 }],
        ["bb-shrugs", { tier: 1, sets: 3, reps: "8", rpe: "8", rest: 60 }],
        ["bb-curls", { tier: 1, sets: 3, reps: "8", rpe: "8", rest: 60 }],
        ["preacher-curl", { tier: 2, sets: 3, reps: "10-12", rpe: "9", rest: 45 }],
        ["ez-skull-crusher", { tier: 3, sets: 3, reps: "10-12", rpe: "9", rest: 45 }],
        ["rear-delt-flyes", { tier: 3, sets: 3, reps: "12-15", rpe: "9", rest: 45 }],
        ["hanging-leg-raise", { tier: 2, sets: 3, reps: "10-12", rpe: "8", rest: 45 }],
        ["prone-neck-extension", { tier: 1, sets: 3, reps: "8-20", rpe: "7", rest: 45 }],
        ["dead-hang", { tier: 1, sets: 2, reps: "max time", rpe: "-", rest: 45, isFinisher: true, finisherProgression: "Building toward advanced pull-up variations. Dead hangs develop grip endurance and scapular stability." }]
      ]
    },
    "legs-a": {
      id: "legs-a", name: "Legs A", type: "power", label: "Power",
      goal: "Strength — heavy compounds, low reps, long rest",
      minutesBySize: { light: 61, normal: 85, extended: 103 },
      warmup: {
        name: "Dynamic Warm-Up",
        duration: "5 minutes",
        movements: [
          { name: "Leg Swings", fig: "leg-swing", text: "Leg swings front to back, 10 each leg" },
          { name: "Lateral Leg Swings", fig: "lateral-leg-swing", text: "Lateral leg swings, 10 each" },
          { name: "Bodyweight Squats", fig: "bw-squat", text: "Bodyweight squats, 10 slow reps focusing on depth" },
          { name: "Walking Lunges", fig: "walking-lunges", text: "Walking lunges, 8 each leg" },
          { name: "Hip Circles", fig: "hip-circles", text: "Hip circles (standing, big circles with the knee), 8 each direction per leg" }
        ]
      },
      exercises: [
        ["kb-swings", { tier: 1, sets: 3, reps: "15", rpe: "7", rest: 45, isPrimer: true }],
        ["bb-back-squat", { tier: 1, sets: 4, reps: "5", rpe: "7-8", rest: 70 }],
        ["romanian-deadlift", { tier: 1, sets: 4, reps: "5", rpe: "7-8", rest: 70 }],
        ["leg-press", { tier: 1, sets: 3, reps: "8", rpe: "8", rest: 60 }],
        ["seated-leg-curl", { tier: 3, sets: 3, reps: "10-12", rpe: "9", rest: 45 }],
        ["hip-adduction", { tier: 3, sets: 3, reps: "15-20", rpe: "8-9", rest: 45 }],
        ["standing-calf-raise", { tier: 1, sets: 4, reps: "10", rpe: "8", rest: 60 }],
        ["hanging-leg-raise", { tier: 1, sets: 3, reps: "10-12", rpe: "8", rest: 45 }],
        ["farmer-carry", { tier: 2, sets: 3, reps: "40 yd", rpe: "8", rest: 60 }],
        ["pallof-press", { tier: 2, sets: 3, reps: "12-15 ea", rpe: "8", rest: 45 }],
        ["side-neck-raise", { tier: 1, sets: 2, reps: "8-15 ea", rpe: "7", rest: 45 }]
      ]
    },
    "push-b": {
      id: "push-b", name: "Push B", type: "hypertrophy", label: "Hypertrophy",
      goal: "Volume — moderate loads, higher reps, controlled tempos",
      minutesBySize: { light: 58, normal: 84, extended: 102 },
      warmup: {
        name: "Dynamic Warm-Up",
        duration: "5 minutes",
        movements: [
          { name: "Arm Circles", fig: "arm-circles", text: "Arm circles, 10 each direction" },
          { name: "Band Dislocates", fig: "band-dislocate", text: "Band dislocates (pass band over and behind head), 10 slow reps" },
          { name: "Scapular Push-Ups", fig: "scapular-pushup", text: "Scapular push-ups (protract and retract shoulder blades without bending elbows), 10 reps" },
          { name: "Light Cable Flyes", fig: "cable-flyes", text: "Light cable flyes, 12 reps to get blood into the chest" }
        ]
      },
      exercises: [
        ["pike-pushup", { tier: 1, sets: 2, reps: "to failure", rpe: "-", rest: 45, isPrimer: true, finisherProgression: "Building toward handstand push-ups. Pike push-ups build overhead pressing strength and shoulder stability." }],
        ["db-incline-press", { tier: 1, sets: 4, reps: "10-12", rpe: "8-9", rest: 60 }],
        ["cable-flyes", { tier: 1, sets: 3, reps: "12-15", rpe: "9", rest: 45 }],
        ["db-lateral-raise", { tier: 1, sets: 4, reps: "12-15", rpe: "8-9", rest: 45 }],
        ["tricep-pushdown", { tier: 1, sets: 3, reps: "12-15", rpe: "9", rest: 45 }],
        ["cable-oh-tricep-ext", { tier: 2, sets: 3, reps: "12-15", rpe: "9", rest: 45 }],
        ["cable-curl-behind", { tier: 3, sets: 3, reps: "12-15 ea", rpe: "9", rest: 45 }],
        ["ez-reverse-curl", { tier: 3, sets: 3, reps: "12-15", rpe: "9", rest: 45 }],
        ["back-extension", { tier: 1, sets: 3, reps: "12-15", rpe: "7-8", rest: 45 }],
        ["crunch-machine", { tier: 2, sets: 3, reps: "15-20", rpe: "8-9", rest: 45 }],
        ["supine-neck-flexion", { tier: 1, sets: 3, reps: "8-20", rpe: "7", rest: 45 }]
      ]
    },
    "pull-b": {
      id: "pull-b", name: "Pull B", type: "hypertrophy", label: "Hypertrophy",
      goal: "Volume — moderate loads, higher reps, controlled tempos",
      minutesBySize: { light: 58, normal: 84, extended: 102 },
      warmup: {
        name: "Dynamic Warm-Up",
        duration: "5 minutes",
        movements: [
          { name: "Band Pull-Aparts", fig: "band-pull-apart", text: "Band pull-aparts, 15 reps" },
          { name: "Arm Circles", fig: "arm-circles", text: "Arm circles, 10 each direction" },
          { name: "Scapular Pull-Ups", fig: "scapular-pull", text: "Scapular pull-ups (pull shoulder blades down without bending elbows), 8 reps" },
          { name: "Single-Arm Dumbbell Rows", fig: "db-row", text: "Light single-arm dumbbell rows, 12 reps to activate the lats" }
        ]
      },
      exercises: [
        ["inverted-row", { tier: 1, sets: 2, reps: "to failure", rpe: "-", rest: 45, isPrimer: true, finisherProgression: "Building toward advanced pull-up variations. Inverted rows build horizontal pulling endurance." }],
        ["seated-cable-row", { tier: 1, sets: 4, reps: "10-12", rpe: "8-9", rest: 60 }],
        ["wide-lat-pulldown", { tier: 1, sets: 4, reps: "10-12", rpe: "8-9", rest: 60 }],
        ["face-pulls", { tier: 1, sets: 3, reps: "15", rpe: "8", rest: 45 }],
        ["db-shrugs", { tier: 2, sets: 3, reps: "12-15", rpe: "9", rest: 45 }],
        ["db-hammer-curls", { tier: 1, sets: 3, reps: "12", rpe: "9", rest: 45 }],
        ["rear-delt-flyes", { tier: 2, sets: 3, reps: "12-15", rpe: "9", rest: 45 }],
        ["tricep-pushdown", { tier: 3, sets: 3, reps: "12-15", rpe: "9", rest: 45 }],
        ["wrist-curl", { tier: 3, sets: 3, reps: "15-20", rpe: "9", rest: 45 }],
        ["back-extension", { tier: 1, sets: 3, reps: "12-15", rpe: "7-8", rest: 45 }],
        ["prone-neck-extension", { tier: 1, sets: 3, reps: "8-20", rpe: "7", rest: 45 }]
      ]
    },
    "legs-b": {
      id: "legs-b", name: "Legs B", type: "hypertrophy", label: "Hypertrophy",
      goal: "Volume — moderate loads, higher reps, controlled tempos",
      minutesBySize: { light: 65, normal: 89, extended: 108 },
      warmup: {
        name: "Dynamic Warm-Up",
        duration: "5 minutes",
        movements: [
          { name: "Leg Swings", fig: ["leg-swing","lateral-leg-swing"], text: "Leg swings, 10 each direction per leg" },
          { name: "Hip Circles", fig: "hip-circles", text: "Hip circles, 8 each direction" },
          { name: "Bodyweight Squats", fig: "bw-squat", text: "Bodyweight squats, 10 reps" },
          { name: "Glute Bridges", fig: "glute-bridge", text: "Glute bridges on the floor, 10 reps with squeeze at top" },
          { name: "Lateral Band Walks", fig: "lateral-band-walk", text: "Lateral band walks, 10 steps each direction (if band available)" }
        ]
      },
      exercises: [
        ["assisted-pistol-squat", { tier: 1, sets: 2, reps: "max each leg", rpe: "-", rest: 45, isPrimer: true, finisherProgression: "Building toward full unassisted pistol squats. Assisted pistols build single-leg strength, balance, and ankle mobility." }],
        ["bulgarian-split-squat", { tier: 1, sets: 4, reps: "10-12 each", rpe: "8-9", rest: 60 }],
        ["lying-leg-curl", { tier: 1, sets: 4, reps: "12", rpe: "9", rest: 45 }],
        ["leg-extension", { tier: 1, sets: 4, reps: "12", rpe: "9", rest: 45 }],
        ["hip-abduction", { tier: 1, sets: 3, reps: "15-20", rpe: "8-9", rest: 45 }],
        ["walking-lunges", { tier: 2, sets: 3, reps: "12 each", rpe: "8-9", rest: 60 }],
        ["hip-thrust", { tier: 3, sets: 3, reps: "8-12", rpe: "8-9", rest: 45 }],
        ["seated-calf-raise", { tier: 1, sets: 4, reps: "15", rpe: "9", rest: 45 }],
        ["standing-calf-raise", { tier: 3, sets: 3, reps: "10", rpe: "8", rest: 45 }],
        ["suitcase-carry", { tier: 2, sets: 3, reps: "40 yd ea", rpe: "8", rest: 60 }],
        ["back-extension", { tier: 1, sets: 3, reps: "12-15", rpe: "7-8", rest: 45 }],
        ["side-neck-raise", { tier: 1, sets: 2, reps: "8-15 ea", rpe: "7", rest: 45 }]
      ]
    },
    "cal-push": {
      id: "cal-push", name: "Calisthenics Push", type: "calisthenics", label: "Bodyweight", code: "CP",
      goal: "Pushing volume with no equipment beyond the floor and a bench or bar",
      minutesBySize: { light: 28, normal: 55, extended: 78 },
      warmup: {
        name: "Dynamic Warm-Up",
        duration: "5 minutes",
        movements: [
          { name: "Arm Circles", fig: "arm-circles", text: "Arm circles, 10 forward and 10 back" },
          { name: "Scapular Push-Ups", fig: "scapular-pushup", text: "Scapular push-ups, 12 reps from a plank" },
          { name: "Wrist Circles and Rocks", fig: "wrist-rocks", text: "Wrist circles and wrist rocks, 30 seconds" },
          { name: "Slow Push-Ups", fig: "pushup", text: "Slow push-ups, 8 reps at half effort" }
        ]
      },
      exercises: [
        ["pike-pushup", { tier: 2, sets: 3, reps: "8-15", rpe: "8-9", rest: 45, isPrimer: true, finisherProgression: "Primer for the handstand push-up. Fresh legs on this, not leftovers." }],
        ["pushup", { tier: 1, sets: 4, reps: "12-20", rpe: "8", rest: 45 }],
        ["bench-dip", { tier: 2, sets: 3, reps: "10-15", rpe: "8", rest: 45 }],
        ["diamond-pushup", { tier: 2, sets: 3, reps: "8-15", rpe: "8-9", rest: 45 }],
        ["archer-pushup", { tier: 3, sets: 3, reps: "5-8 ea", rpe: "9", rest: 60 }],
        ["superman", { tier: 1, sets: 3, reps: "30s", rpe: "7", rest: 45 }],
        ["hollow-hold", { tier: 3, sets: 3, reps: "20-40s", rpe: "8", rest: 45 }],
        ["neck-isometrics", { tier: 1, sets: 2, reps: "4 dir x 10s", rpe: "-", rest: 30 }]
      ]
    },
    "cal-pull": {
      id: "cal-pull", name: "Calisthenics Pull", type: "calisthenics", label: "Bodyweight", code: "CB",
      goal: "Pulling volume from a bar. Park pull-up bar or anything you can hang from",
      minutesBySize: { light: 28, normal: 55, extended: 78 },
      warmup: {
        name: "Dynamic Warm-Up",
        duration: "5 minutes",
        movements: [
          { name: "Arm Circles", fig: "arm-circles", text: "Arm circles, 10 each direction" },
          { name: "Scapular Pulls", fig: "scapular-pull", text: "Scapular pulls from a dead hang, 8 reps" },
          { name: "Band Pull-Aparts", fig: "band-pull-apart", text: "Band pull-aparts or arm swings, 15 reps" },
          { name: "Easy Pull-Ups", fig: "pullup-bw", text: "Two easy sets of 3 pull-ups at half effort" }
        ]
      },
      exercises: [
        ["pullup-bw", { tier: 1, sets: 4, reps: "5-12", rpe: "8-9", rest: 60 }],
        ["inverted-row", { tier: 1, sets: 3, reps: "10-15", rpe: "8", rest: 45, tip: "Bar at hip height, body straight, pull the chest to the bar. Lower the bar to make it harder, raise it to make it easier. Horizontal pulling, which balances all the pushing." }],
        ["chinup-bw", { tier: 2, sets: 3, reps: "6-12", rpe: "8-9", rest: 60 }],
        ["superman", { tier: 1, sets: 3, reps: "30s", rpe: "7", rest: 45 }],
        ["hanging-leg-raise", { tier: 2, sets: 3, reps: "10-12", rpe: "8", rest: 45 }],
        ["neck-isometrics", { tier: 1, sets: 2, reps: "4 dir x 10s", rpe: "-", rest: 30 }],
        ["hollow-hold", { tier: 3, sets: 3, reps: "20-40s", rpe: "8", rest: 45 }],
        ["dead-hang", { tier: 3, sets: 2, reps: "max time", rpe: "-", rest: 45, isFinisher: true, finisherProgression: "Grip endurance for every pulling movement you own. Always last, never before the rows." }]
      ]
    },
    "cal-legs": {
      id: "cal-legs", name: "Calisthenics Legs", type: "calisthenics", label: "Bodyweight", code: "CL",
      goal: "Leg volume through tempo, single-leg work, and reps instead of load",
      minutesBySize: { light: 28, normal: 55, extended: 78 },
      warmup: {
        name: "Dynamic Warm-Up",
        duration: "5 minutes",
        movements: [
          { name: "Leg Swings", fig: ["leg-swing","lateral-leg-swing"], text: "Leg swings, 10 each direction per leg" },
          { name: "Bodyweight Squats", fig: "bw-squat", text: "Bodyweight squats, 15 easy reps" },
          { name: "Walking Knee Hugs", fig: "knee-hug", text: "Walking knee hugs and ankle rolls, 30 seconds" },
          { name: "Glute Bridges", fig: "glute-bridge", text: "Glute bridges, 15 reps" }
        ]
      },
      exercises: [
        ["broad-jump", { tier: 2, sets: 3, reps: "5", rpe: "-", rest: 60, isPrimer: true, finisherProgression: "Hip power without a box to catch your shin. Fresh, before the legs are cooked." }],
        ["bw-squat", { tier: 1, sets: 4, reps: "20-30", rpe: "7-8", rest: 45 }],
        ["single-leg-rdl", { tier: 1, sets: 3, reps: "10-12 ea", rpe: "8", rest: 45 }],
        ["bw-lunge", { tier: 2, sets: 3, reps: "16-20 ea", rpe: "8", rest: 45 }],
        ["step-up", { tier: 2, sets: 3, reps: "12-15 ea", rpe: "8", rest: 45 }],
        ["glute-bridge", { tier: 2, sets: 3, reps: "12-15 ea", rpe: "8", rest: 45 }],
        ["bw-calf-raise", { tier: 1, sets: 3, reps: "15-20 ea", rpe: "8", rest: 45 }],
        ["wall-sit", { tier: 3, sets: 3, reps: "max time", rpe: "8", rest: 45 }],
        ["assisted-pistol-squat", { tier: 3, sets: 2, reps: "max ea", rpe: "-", rest: 45, tip: "Hold a post or doorframe for balance, one leg forward, sit all the way down. Use as little assistance as you can manage. Building to the unassisted pistol." }]
      ]
    },
    "cal-full": {
      id: "cal-full", name: "Calisthenics Full Body", type: "calisthenics", label: "Bodyweight", code: "CF",
      goal: "One session that touches everything. The travel and no-gym default",
      minutesBySize: { light: 30, normal: 58, extended: 82 },
      warmup: {
        name: "Dynamic Warm-Up",
        duration: "5 minutes",
        movements: [
          { name: "Arm Circles and Leg Swings", fig: ["arm-circles","leg-swing"], text: "Arm circles and leg swings, 30 seconds each" },
          { name: "Bodyweight Squats", fig: "bw-squat", text: "Bodyweight squats, 15 reps" },
          { name: "Scapular Push-Ups", fig: "scapular-pushup", text: "Scapular push-ups, 10 reps" },
          { name: "Glute Bridges", fig: "glute-bridge", text: "Glute bridges, 15 reps" }
        ]
      },
      exercises: [
        ["pushup", { tier: 1, sets: 4, reps: "12-20", rpe: "8", rest: 45 }],
        ["pullup-bw", { tier: 1, sets: 4, reps: "5-12", rpe: "8-9", rest: 60 }],
        ["bw-squat", { tier: 1, sets: 4, reps: "20-30", rpe: "7-8", rest: 45 }],
        ["neck-isometrics", { tier: 1, sets: 2, reps: "4 dir x 10s", rpe: "-", rest: 30 }],
        ["inverted-row", { tier: 2, sets: 3, reps: "10-15", rpe: "8", rest: 45, tip: "Bar at hip height, body straight, pull the chest to the bar. Lower the bar to make it harder, raise it to make it easier. Horizontal pulling, which balances all the pushing." }],
        ["single-leg-rdl", { tier: 2, sets: 3, reps: "10-12 ea", rpe: "8", rest: 45 }],
        ["superman", { tier: 2, sets: 3, reps: "30s", rpe: "7", rest: 45 }],
        ["pike-pushup", { tier: 3, sets: 3, reps: "8-15", rpe: "8-9", rest: 45 }],
        ["hanging-leg-raise", { tier: 3, sets: 3, reps: "10-12", rpe: "8", rest: 45 }],
        ["burpee", { tier: 3, sets: 3, reps: "10-15", rpe: "8", rest: 60 }]
      ]
    },
    "back-core": {
      id: "back-core", name: "Back & Core", type: "power", label: "Posterior & Core", code: "C",
      goal: "Everything protecting the lower back and neck, in one session",
      minutesBySize: { light: 30, normal: 55, extended: 78 },
      warmup: {
        name: "Dynamic Warm-Up",
        duration: "5 minutes",
        movements: [
          { name: "Cat-Cow", fig: "cat-cow", text: "Cat-cow, 10 slow reps" },
          { name: "Bird Dog", fig: "bird-dog", text: "Bird dog, 8 reps each side" },
          { name: "Band Pull-Aparts", fig: "band-pull-apart", text: "Band pull-aparts, 15 reps" },
          { name: "Glute Bridges", fig: "glute-bridge", text: "Glute bridges, 15 reps" }
        ]
      },
      exercises: [
        ["back-extension", { tier: 1, sets: 3, reps: "12-15", rpe: "7-8", rest: 45 }],
        ["chest-supported-row", { tier: 1, sets: 3, reps: "10-12", rpe: "8", rest: 60 }],
        ["dead-bug", { tier: 1, sets: 3, reps: "10-12 ea", rpe: "7-8", rest: 45 }],
        ["neck-isometrics", { tier: 1, sets: 2, reps: "4 dir x 10s", rpe: "-", rest: 30 }],
        ["face-pulls", { tier: 2, sets: 3, reps: "15", rpe: "8", rest: 45 }],
        ["pallof-press", { tier: 2, sets: 3, reps: "12-15 ea", rpe: "8", rest: 45 }],
        ["hanging-leg-raise", { tier: 2, sets: 3, reps: "10-12", rpe: "8", rest: 45 }],
        ["bird-dog", { tier: 3, sets: 3, reps: "10-12 ea", rpe: "7", rest: 45 }],
        ["decline-plate-crunch", { tier: 3, sets: 3, reps: "12-15", rpe: "8-9", rest: 45 }],
        ["suitcase-carry", { tier: 3, sets: 3, reps: "40 yd ea", rpe: "8", rest: 60 }],
        ["prone-neck-extension", { tier: 3, sets: 3, reps: "8-20", rpe: "7", rest: 45 }]
      ]
    },
  },

  cardio: [
    {
      id: "cardio-treadmill",
      name: "Treadmill",
      trackMode: "cardio",
      sets: 1, reps: "-", rpe: "-", rest: 0, restLabel: "-", weightMode: "free", tier: 1,
      dist: { label: "Distance", unit: "mi" },
      level: { label: "Incline", unit: "%" },
      tip: "Log what the console shows when you step off. Incline is the treadmill's resistance: note the one you held longest."
    },
    {
      id: "cardio-stair-stepper",
      name: "Stair Stepper",
      trackMode: "cardio",
      sets: 1, reps: "-", rpe: "-", rest: 0, restLabel: "-", weightMode: "free", tier: 1,
      dist: { label: "Floors", unit: "fl" },
      level: { label: "Level", unit: "level" },
      tip: "Stand tall and keep your weight off the rails: leaning on them takes the legs out of it."
    },
    {
      id: "cardio-bike",
      name: "Bike",
      trackMode: "cardio",
      sets: 1, reps: "-", rpe: "-", rest: 0, restLabel: "-", weightMode: "free", tier: 1,
      dist: { label: "Distance", unit: "mi" },
      level: { label: "Resistance", unit: "level" },
      tip: "Seat height: a slight bend in the knee at the bottom of the pedal stroke."
    },
    {
      id: "cardio-elliptical",
      name: "Elliptical",
      trackMode: "cardio",
      sets: 1, reps: "-", rpe: "-", rest: 0, restLabel: "-", weightMode: "free", tier: 1,
      dist: { label: "Distance", unit: "mi" },
      level: { label: "Resistance", unit: "level" },
      tip: "Push and pull the handles rather than just holding on, and keep your heels down."
    }
  ],

  // e1RM calculation using Epley formula
  // weight × (1 + reps / 30)
  calculateE1RM: function(weight, reps) {
    if (reps === 1) return weight;
    return Math.round(weight * (1 + reps / 30));
  }
};


// Each day's list becomes full exercise objects: the move's shared fields,
// then the day's own. One object per day, so a toggle saved for one move
// (BW / BW+ / BW-) is applied to every day by id in app.js.
Object.values(FORGE_DATA.workouts).forEach(w => {
  w.exercises = w.exercises.map(([id, day]) => {
    const move = MOVES[id];
    if (!move) throw new Error('FORGE data: no move called ' + id);
    return Object.assign({ id: id }, move, day, { restLabel: day.rest + ' sec' });
  });
});

if (typeof window !== 'undefined') window.FORGE_DATA = FORGE_DATA;
