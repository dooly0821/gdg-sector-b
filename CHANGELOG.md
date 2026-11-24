# V3.5 — Dual Carry & Glove Motion

- Q 운반 중 손전등 전환, 왼손 하단 받침과 엄지 접촉.
- E 작업 시 자동 수납/복귀, 집기 0.48초, 배치 0.52초.
- 손바닥·손가락·소매 볼륨 증가 및 빈손/접근 단계의 실시간 굴곡 변형.
- 속도 기반 임계감쇠 스프링을 화물과 손에 공동 적용. 기존 이동 물리는 그대로 유지.

# V3.4 — Responsive Handling
- 집기 1.10→0.58초, 내려놓기 1.12→0.64초, Q 장착 0.25→0.18초, 수납 약 0.22→0.16초.
- 기존 접촉 구간, 상자와 손의 공유 변환, 소매 연결, 이동 물리, 모델 유지.
- 120Hz 및 30/60Hz 애니메이션 타이밍 회귀 검사 추가.

# V3.3 — Contact & Handling
- 장갑 및 손전등 접촉 모델 재생성. 상자 표면과 원통 그립에 맞춘 형상, 장갑 관통 표본 검사 추가.
- 상자와 양손 공통 변환; 접근/파지/들기/내려놓기/회수; 소매 연결 변환. 접촉 전 접근 거리 1.45m.
- Q 토글 정확한 0/1 종료 및 E 대기 로직 복구. 기존 이동 물리 코드 보존.
- CPU 렌더 결과 및 테스트 추가. WebGL 미검증.

# V3.2 — Hand Pose Refine

- 빈손 휴지 포즈를 갈고리처럼 보이던 형태에서 더 완만한 손가락 만곡과 두꺼운 손바닥 형태로 재조정
- 손전등 그립 포즈를 다시 제작해 손가락 말림, 엄지 위치, 손목 각도, 소매 연결감을 개선
- 상자 운반용 양손 포즈를 더 자연스럽게 위로 당기고 손가락 훅 형태를 다듬음
- `dist/handling.js`에서 휴지 breathing, 이동 bob, 손전등 전환 애니메이션, 손의 관성 lag를 조정
- `modeling/build_viewmodel.py` 재생성 후 `dist/viewmodel-mesh-data.js`, `modeling/*.glb`, `modeling/*joined-glove.obj` 갱신

# V3 Foundation
- 기존 창고 장면, 5개 미션, UI, 텍스처 보존.
- 독립 movement.js 이동 물리. 120Hz 고정 업데이트. 마찰, 가속, 벽 슬라이딩, 공중 제어, 착지 입력 버퍼, 단차 처리.
- 1인칭 손 마디/장갑 실루엣 보완, 큰 뷰모델, 소매 노란 띠, 오른손 손전등 장비.
- Q 토글, E 집기 전 자동 수납, 운반 중 Q 차단, HUD/매뉴얼 및 마우스 휠 점프 추가.
- WebGL 월드 표면 스포트라이트 및 CPU 깊이 기반 조명.
- 회귀 테스트 및 출품 체크리스트 추가. 사이트 배포 없음.

## V3.1 — 2026-11-24
- Replaced all V3 primitive hands and sleeves with connected custom surface meshes and tailored cloth geometry.
- Added original material textures, improved torch mesh, grip pose, viewmodel lighting, and packed runtime geometry.
- Preserved V3 movement and mission logic; Q toggle and E interlock unchanged.
- Added editable GLB/OBJ assets and generator. No finger skinning yet.

## V3.5 glove articulation follow-up
- Split relaxed/reaching finger curl into two serial joint regions in WebGL and CPU fallback, keeping the palm and cuff stationary.
- Added rounded joint reinforcement and seam accents using existing glove materials/textures; regenerated source OBJ/GLB and packed runtime meshes.
- Staggered flashlight finger wrap angles for the finger cascade; kept hand/tool transforms and authored contact clearance.
- Restored missing mission/physics regression scripts and added finger continuity and Chromium smoke checks. See TEST-RESULTS.md for measured coverage and limits.
