@echo off
rem Nightly scrape of the shops that block GitHub's runners (403 from
rem data-centre addresses, 2026-10-24). Run by the Windows scheduled task
rem "MobilePrices nightly scrape" from a home connection; banana.lk and
rem idealz.lk run on GitHub instead. One log file per night in logs\.
cd /d "%~dp0.."
if not exist logs mkdir logs
for /f %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd"') do set DAY=%%d
set LOG=logs\nightly-%DAY%.log
for %%s in (lifemobile.lk celltronics.lk geniusmobile.lk doctormobile.lk) do (
  echo == %%s %DATE% %TIME% >> "%LOG%"
  call npm run scrape -- %%s >> "%LOG%" 2>&1
)
rem Normalize straight away: the PC may scrape after GitHub's 03:00
rem normalize (asleep or off overnight). Re-runs find nothing new.
echo == normalize %DATE% %TIME% >> "%LOG%"
call npm run normalize >> "%LOG%" 2>&1
rem Specs from GSMArena after normalize, so new models are looked up the
rem same night. 400 requests at 5 s is about 35 minutes. A brand's whole list
rem is read each time it has a new model, so the backfill takes a few nights.
echo == specs %DATE% %TIME% >> "%LOG%"
call npm run specs -- --max-requests 400 >> "%LOG%" 2>&1
echo == done %DATE% %TIME% >> "%LOG%"
