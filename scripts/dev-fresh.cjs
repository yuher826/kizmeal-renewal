// npm run dev:fresh
//
// 오늘 반복된 "Internal Server Error / .next static chunks UNKNOWN 에러" 원인 두 가지를
// 한 번에 정리하고 dev 서버를 새로 띄운다.
//   1) 포트 3000에 이전 dev 서버의 node 프로세스가 좀비로 남아있는 경우
//      (Claude Code의 TaskStop이 셸 껍데기만 죽이고 실제 node는 못 죽이는 케이스가 있었음)
//   2) npm run build(운영용) 직후 바로 npm run dev(개발용)를 얹어서 .next 캐시가
//      꼬이는 경우 (Windows에서 흔한 증상)
//
// Windows 전용(office/home PC 둘 다 Windows). netstat으로 3000번 포트를 점유한
// PID를 찾아 taskkill로 정리한 뒤, .next를 삭제하고 next dev를 새로 띄운다.

const { execSync, spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const PORT = 3000

function killPort(port) {
  let output = ''
  try {
    output = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf-8' })
  } catch {
    // findstr이 매치 없으면 에러 코드를 던짐 = 포트가 비어있다는 뜻이라 정상 상황
    console.log(`✓ 포트 ${port} 비어있음`)
    return
  }

  const pids = new Set()
  for (const line of output.split('\n')) {
    const match = line.trim().match(/LISTENING\s+(\d+)\s*$/)
    if (match) pids.add(match[1])
  }

  if (pids.size === 0) {
    console.log(`✓ 포트 ${port} 비어있음`)
    return
  }

  for (const pid of pids) {
    try {
      execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' })
      console.log(`✓ 좀비 프로세스 종료 (PID ${pid})`)
    } catch {
      console.log(`  (PID ${pid} 종료 시도했으나 이미 없어진 상태일 수 있음 — 무시)`)
    }
  }
}

function removeNextCache() {
  const nextDir = path.join(process.cwd(), '.next')
  if (fs.existsSync(nextDir)) {
    fs.rmSync(nextDir, { recursive: true, force: true })
    console.log('✓ .next 캐시 삭제 완료')
  } else {
    console.log('✓ .next 캐시 없음(이미 깨끗함)')
  }
}

console.log('── dev 서버 깨끗하게 재시작 ──')
killPort(PORT)
removeNextCache()
console.log('── next dev 기동 ──')

// shell:true + 배열 인자 조합은 Node DEP0190 경고 대상(인자 이스케이프 방식이
// 셸마다 달라 위험할 수 있음). 여기 인자는 고정 문자열이라 실질 위험은 없지만,
// 문자열 커맨드 하나로 넘기는 형태가 그 경고 자체를 깔끔하게 피한다.
const child = spawn('npx next dev', { stdio: 'inherit', shell: true })
child.on('exit', code => process.exit(code ?? 0))
