# V3.5 QA
- PASS: check-dual (3,165,729 vertex samples across 121 transfer phases; 30/60/120 Hz transition and delivery), check-physics, check-mission (5/5), check-contact-motion (242 phases), check-hand-timing (30/60/120 Hz).
- PASS: check_contacts.py, static glove/parcel and flashlight surface samples; mesh connectivity. Sample-based tests do not prove every triangle or frame free of intersection.
- Offline CPU rendered and inspected dual/idle frames. WebGL, actual browser input, subjective motion smoothness and FPS remain unverified. Not a full skeletal rig or rigid-body cargo simulation.

# V3.4 QA
- PASS: check-physics, check-mission (5/5), check-contact-motion (242 phases), check-hand-timing (30,60,120 Hz).
- 모델/렌더러 변경 없음. 실제 브라우저 프레임레이트 및 체감 속도 미검증.

# V3.3 QA — 2026-11-24
- PASS `node scripts/check-physics.mjs`: 기존 이동, 점프, 충돌, Q 토글 및 화물 인터락. 집기 시간 변경에 맞춰 검증 시간 수정.
- PASS `node scripts/check-mission.mjs`: 5/5 배송, 상층 왕복, 취소, 중복 방지; 접근 거리 변경 반영, 318.7 m.
- PASS `node scripts/check-contact-motion.mjs`: 집기/내려놓기 242개 시점에서 공통 변환, 손목-소매 연결, 상호작용 거리 제한, Q 종료값 검증.
- PASS `python modeling/check_contacts.py`: 실제 packed mesh 표본 기준 양손 각 221,060개 표본 중 박스 내부 0개 (최소 2.6mm); 손전등 몸통 241,306개 표본 중 내부 0개 (최소 약 1.6mm); 스위치/가드 표본 내부 0개. 이는 표본 기반 검사이며 전체 연속 충돌 보장 아님.
- PASS 모델링 메시 연결성 및 폐곡면 검사: 모든 장갑 1개 연결 메시, watertight.
- CPU 오프라인 렌더 검수: 빈손, 손전등, 운반 및 집기 중간 프레임. 브라우저 캡처 아님.
- 미검증: 실제 브라우저 WebGL, 프레임레이트, Pointer Lock, 공모전 임베드, 손가락 리깅/실사 품질. 동적 강체는 후속 개발.

## 이전 버전 기록
# V3 QA / 2026-11-24
Node v22.16.0.
- check-physics.mjs PASS: acceleration, friction, wall sliding, escape, overlap recovery, step-up, high obstacle, jump height 0.963m, momentum, air strafe, buffered hop, world bounds, ceiling, torch toggle, model batches, cargo interlock.
- check-mission.mjs PASS at 120Hz: five full walking routes, upper deck ascent/descent, jump/landing, rack collision, animated pickup/placement, cancelled reach, five stable dock slots, duplicate input prevention. Travel 311.7 m.
- CPU renderer offline smoke test PASS: 1100×619 empty and flashlight renders via Node offline image/canvas adapter; some signs text and HUD are not rendered. Not live browser screenshots.
- Chromium live browser navigation to localhost: ERR_BLOCKED_BY_ADMINISTRATOR. WebGL shader execution, actual keyboard input, pointer lock, frame rate and public deployment remain unverified.

## V3.1
- PASS: `node scripts/check-physics.mjs` (movement, Q toggle, interlock).
- PASS: `node scripts/check-mission.mjs` (5/5 cargo delivery; 311.7 m).
- PASS: offline CPU renderer output at 1100×619 for empty, torch, and carry poses. These are not WebGL browser screenshots.
- Source mesh checks: see modeling/mesh-report.json.
- Not verified: real browser rendering, GPU frame rate, pointer lock, embedding, full contest eligibility.

# V3.5 glove articulation follow-up — 2026-11-24
- Base: `7ee6224b34c62af0b4d732ccc8b5ea77d17f1b8c` (`main`).
- PASS: restored missing `check-physics.mjs` and `check-mission.mjs`. Five parcel pickup/delivery flows at 30/60/120 Hz, including upper parcel, Q during carry, distinct dock slots, cancellation and duplicate guards. Mission tests position the player at collision-free approaches; they do not simulate all walking routes. Separate physics checks exercise ramp ascent/descent, wall collision, jump height, airborne momentum and buffered bunny hop.
- PASS: existing contact-motion (242 phases), hand-timing and dual-carry tests; 3,175,846 sampled transfer vertices. Finger-motion: 471,408 samples across both relaxed gloves, fixed palm and continuous two-joint bends.
- PASS: packed static mesh contact samples. Minimum clearance: carry 3.99 mm, support 3.34 mm, torch barrel 4.96 mm; guard/switch have no penetrating samples. All glove meshes remain connected and watertight. These samples do not establish continuous triangle collision freedom or cover arbitrary world geometry; the original foreground viewmodel depth behavior remains.
- PASS: actual headless Chromium WebGL2 startup, compiled shaders, Q keyboard equip and screenshots inspected at 1280×720; no page errors. SwiftShader was used, so hardware GPU performance, subjective smoothness, and complete browser-driven delivery routes remain unverified.
- Browser reproduction: serve `dist` at port 8090, run `node scripts/check-browser.mjs` with Playwright available and `/usr/bin/chromium` installed; optional `QA_CAPTURE_DIR` saves screenshots. No runtime dependency or deployment setting was added.
- Preserved: map, UI, all existing texture files, mission and movement source, Vercel configuration, and paths within `dist`.

# C-01 야간 분류동 확장
- PASS: 배송 5건의 집기·출고를 30/60/120Hz에서 검증했습니다. 상층 경사로 왕복, 공중 관성, 버니합 입력 버퍼와 기존 충돌도 통과했습니다.
- PASS: check-expansion. 빈손/운반 중 전방 광축, 분류동 왕복, 난간과 화물 넘기, 천장에 막힌 동작 차단, 바닥 적치 후 재집기/출고, 괴물의 빛 반응과 복귀 시 화물 보존을 확인했습니다.
- PASS: check-contact-motion, check-hand-timing, check-finger-motion, check-dual. 손전등 렌더 변환을 적용한 상자 전환 메시 표본 3,175,846개에서 관통이 검출되지 않았습니다. 이 검사는 모든 물체 및 프레임의 연속 충돌 검사까지 포함하지 않습니다.
- PASS: Chromium WebGL2에서 Q/E 실제 입력으로 집기, 한 손 운반과 손전등, 바닥 적치, 다시 집기, 출고를 확인했습니다. 테스트는 상호작용 지점에 플레이어를 배치합니다. C-01 화면도 캡처했습니다. 브라우저의 전 구간 수동 플레이와 GPU 성능은 별도 확인이 필요합니다.
