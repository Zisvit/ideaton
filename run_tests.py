import subprocess
import sys

HERE = __import__('os').path.dirname(__import__('os').path.abspath(__file__))
PY = '/home/php/.venvs/minutka/bin/python'

SUITES = [
    ('front (PWA/темы/Сургут/сессии)', [PY, 'test_front.py']),
    ('e2e (полный цикл аренды)', [PY, 'test_e2e.py']),
    ('stress (краевые + 50 циклов)', [PY, 'test_stress.py']),
]
if '--full' in sys.argv:
    SUITES.append(('x100 (100 циклов)', [PY, 'test_100.py']))


def main():
    failed = []
    for name, cmd in SUITES:
        print(f'\n===== {name} =====', flush=True)
        r = subprocess.run(cmd, cwd=HERE)
        print(f'--- {name}: {"PASS" if r.returncode == 0 else "FAIL"}', flush=True)
        if r.returncode != 0:
            failed.append(name)
    print('\n===== ИТОГ =====', flush=True)
    if failed:
        print('FAIL:', ', '.join(failed), flush=True)
        return 1
    print(f'ALL SUITES PASS ({len(SUITES)}/{len(SUITES)})', flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
