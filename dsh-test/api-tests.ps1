$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$base = 'http://localhost:9999'
$ts = Get-Date -Format 'HHmmss'
$results = New-Object System.Collections.Generic.List[object]

function AddResult($id, $name, $expected, $actual, $pass) {
	$results.Add([pscustomobject]@{
		ID = $id; Case = $name; Expected = $expected; Actual = $actual
		Result = $(if ($pass) { 'PASS' } else { 'FAIL' })
	}) | Out-Null
}

function PostJson($path, $obj) {
	$json = $obj | ConvertTo-Json -Depth 8 -Compress
	$file = "$env:TEMP\dsh-qa-body.json"
	[System.IO.File]::WriteAllText($file, $json, (New-Object System.Text.UTF8Encoding($false)))
	$out = (& curl.exe -s -X POST "$base$path" -H 'Content-Type: application/json; charset=utf-8' --data-binary "@$file") -join "`n"
	return $out | ConvertFrom-Json
}
function GetJson($path) {
	$out = (& curl.exe -s "$base$path") -join "`n"
	return $out | ConvertFrom-Json
}
function DeleteApi($path) {
	$out = (& curl.exe -s -X DELETE "$base$path") -join "`n"
	return $out | ConvertFrom-Json
}
function Check($id, $name, $expected, $actual, $pass) {
	AddResult $id $name $expected $actual $pass
}

$email = "qa$ts@example.com"
$tel = "199$($ts)00"
$email2 = "qa2$ts@example.com"
$userName = "qa$ts"
$userName2 = "qa2$ts"

# ---------- 1. 验证码 ----------
$send = PostJson '/user/email-code' @{ email = $email; scene = 'register' }
$code = "$($send.data.code)"
Check 'TC-01' '发送注册验证码（演示模式）' 'code=0, mock=true, 6 位码' "code=$($send.code), mock=$($send.data.mock), code=$code" ($send.code -eq '0' -and $send.data.mock -eq $true -and $code.Length -eq 6)

$wrong = if ($code -ne '000000') { '000000' } else { '111111' }
$v1 = PostJson '/user/verify-code' @{ email = $email; scene = 'register'; code = $wrong }
Check 'TC-02' '错误验证码被拒绝' 'code=-1' "code=$($v1.code) msg=$($v1.msg)" ($v1.code -eq '-1')

$v2 = PostJson '/user/verify-code' @{ email = $email; scene = 'register'; code = $code }
Check 'TC-03' '正确验证码通过' 'code=0' "code=$($v2.code)" ($v2.code -eq '0')

$v3 = PostJson '/user/verify-code' @{ email = $email; scene = 'register'; code = $code }
Check 'TC-04' '验证码一次性（重复使用被拒）' 'code=-1' "code=$($v3.code) msg=$($v3.msg)" ($v3.code -eq '-1')

$v4 = PostJson '/user/email-code' @{ email = $email; scene = 'register' }
Check 'TC-05' '60 秒内重复发送被限流' 'code=-1' "code=$($v4.code) msg=$($v4.msg)" ($v4.code -eq '-1')

$resetSend = PostJson '/user/email-code' @{ email = $email; scene = 'reset' }
$resetCode = "$($resetSend.data.code)"
$cross = PostJson '/user/verify-code' @{ email = $email; scene = 'register'; code = $resetCode }
Check 'TC-06' '场景隔离（重置码不能用于注册）' 'code=-1' "code=$($cross.code)" ($cross.code -eq '-1')

$badEmail = PostJson '/user/email-code' @{ email = 'bad-email'; scene = 'register' }
Check 'TC-07' '邮箱格式校验' 'code=-1' "code=$($badEmail.code) msg=$($badEmail.msg)" ($badEmail.code -eq '-1')

# ---------- 2. 注册校验 ----------
$regBadEmail = PostJson '/user/register' @{ username = "bad$ts"; password = 'Test1234'; name = '测试'; sex = '男'; email = 'not-an-email'; tel = $tel; role = '巡检员' }
Check 'TC-08' '注册时非法邮箱被拒绝' 'code=-1' "code=$($regBadEmail.code) msg=$($regBadEmail.msg)" ($regBadEmail.code -eq '-1')

$regNoName = PostJson '/user/register' @{ username = ''; password = 'Test1234'; email = "noname$ts@example.com"; tel = $tel }
Check 'TC-09' '空账号被拒绝' 'code=-1' "code=$($regNoName.code) msg=$($regNoName.msg)" ($regNoName.code -eq '-1')

$regNoPwd = PostJson '/user/register' @{ username = "nopwd$ts"; password = ''; email = "nopwd$ts@example.com"; tel = $tel }
Check 'TC-10' '空密码被拒绝' 'code=-1' "code=$($regNoPwd.code) msg=$($regNoPwd.msg)" ($regNoPwd.code -eq '-1')

$regDupName = PostJson '/user/register' @{ username = 'fanshihao'; password = 'Test1234'; name = '测试'; sex = '男'; email = "dupname$ts@example.com"; tel = $tel; role = '巡检员' }
Check 'TC-11' '用户名重复被拒绝' 'code=-1' "code=$($regDupName.code) msg=$($regDupName.msg)" ($regDupName.code -eq '-1')

$regDupEmail = PostJson '/user/register' @{ username = "dupemail$ts"; password = 'Test1234'; name = '测试'; sex = '男'; email = '3456642104@qq.com'; tel = $tel; role = '巡检员' }
Check 'TC-12' '邮箱重复被拒绝（修复点）' 'code=-1 且提示邮箱' "code=$($regDupEmail.code) msg=$($regDupEmail.msg)" ($regDupEmail.code -eq '-1' -and "$($regDupEmail.msg)".Contains('邮箱'))

$regDupEmailCase = PostJson '/user/register' @{ username = "dupcase$ts"; password = 'Test1234'; name = '测试'; sex = '男'; email = '3456642104@QQ.COM'; tel = $tel; role = '巡检员' }
Check 'TC-13' '邮箱大小写变体也算重复' 'code=-1 且提示邮箱' "code=$($regDupEmailCase.code) msg=$($regDupEmailCase.msg)" ($regDupEmailCase.code -eq '-1' -and "$($regDupEmailCase.msg)".Contains('邮箱'))

$regDupTel = PostJson '/user/register' @{ username = "duptel$ts"; password = 'Test1234'; name = '测试'; sex = '男'; email = "duptel$ts@example.com"; tel = '15893646659'; role = '巡检员' }
Check 'TC-14' '手机号重复被拒绝' 'code=-1 且提示手机号' "code=$($regDupTel.code) msg=$($regDupTel.msg)" ($regDupTel.code -eq '-1' -and "$($regDupTel.msg)".Contains('手机号'))

$regOk = PostJson '/user/register' @{ username = $userName; password = 'Test1234'; name = '测试账号'; sex = '男'; email = $email; tel = $tel; role = '巡检员' }
$userId = $regOk.data.id
Check 'TC-15' '正常注册成功' 'code=0 且有 id' "code=$($regOk.code) id=$userId msg=$($regOk.msg)" ($regOk.code -eq '0' -and $null -ne $userId)

$regReuse = PostJson '/user/register' @{ username = "reuse$ts"; password = 'Test1234'; name = '测试'; sex = '男'; email = $email; tel = "198$($ts)11"; role = '巡检员' }
Check 'TC-16' '同一邮箱不能注册第二个账号' 'code=-1 且提示邮箱' "code=$($regReuse.code) msg=$($regReuse.msg)" ($regReuse.code -eq '-1' -and "$($regReuse.msg)".Contains('邮箱'))

# 前后空格自动 trim
$trimEmail = "  qa2$ts@example.com  "
$regTrim = PostJson '/user/register' @{ username = "  qa2$ts  "; password = 'Test1234'; name = '测试2'; sex = '女'; email = $trimEmail; tel = "198$($ts)22"; role = '巡检员' }
$userId2 = $regTrim.data.id
$trimRead = GetJson "/user/qa2$ts"
Check 'TC-17' '邮箱/账号前后空格自动去除' 'code=0 且存储值无空格' "code=$($regTrim.code) stored=$($trimRead.data.email)" ($regTrim.code -eq '0' -and "$($trimRead.data.email)" -eq "qa2$ts@example.com")

# ---------- 3. 修改资料唯一性 ----------
$updName = PostJson '/user/update' @{ id = $userId; username = $userName; name = '测试账号改'; email = $email; tel = $tel; role = '巡检员'; password = 'Test1234' }
Check 'TC-18' '保持自己邮箱改姓名可成功' 'code=0' "code=$($updName.code) msg=$($updName.msg)" ($updName.code -eq '0')

$updEmail = PostJson '/user/update' @{ id = $userId; username = $userName; name = '测试账号改'; email = '3456642104@qq.com'; tel = $tel; role = '巡检员' }
Check 'TC-19' '改成他人邮箱被拒绝' 'code=-1' "code=$($updEmail.code) msg=$($updEmail.msg)" ($updEmail.code -eq '-1')

$updTel = PostJson '/user/update' @{ id = $userId; username = $userName; name = '测试账号改'; email = $email; tel = '15893646659'; role = '巡检员' }
Check 'TC-20' '改成他人手机号被拒绝' 'code=-1' "code=$($updTel.code) msg=$($updTel.msg)" ($updTel.code -eq '-1')

# ---------- 4. 忘记密码 ----------
$weak = PostJson '/user/reset-password' @{ email = $email; code = $resetCode; newPassword = '123456' }
Check 'TC-21' '弱密码（纯数字）被拒绝' 'code=-1' "code=$($weak.code) msg=$($weak.msg)" ($weak.code -eq '-1')

$wrongReset = PostJson '/user/reset-password' @{ email = $email; code = '000000'; newPassword = 'NewPass123' }
Check 'TC-22' '重置密码时错误验证码被拒绝' 'code=-1' "code=$($wrongReset.code) msg=$($wrongReset.msg)" ($wrongReset.code -eq '-1')

$resetOk = PostJson '/user/reset-password' @{ email = $email; code = $resetCode; newPassword = 'NewPass123' }
Check 'TC-23' '正确验证码重置密码成功' 'code=0' "code=$($resetOk.code) msg=$($resetOk.msg)" ($resetOk.code -eq '0')

$loginNew = PostJson '/user/login' @{ username = $userName; password = 'NewPass123'; role = '巡检员' }
Check 'TC-24' '新密码可登录' 'code=0' "code=$($loginNew.code)" ($loginNew.code -eq '0')

$loginOld = PostJson '/user/login' @{ username = $userName; password = 'Test1234'; role = '巡检员' }
Check 'TC-25' '旧密码登录失败' 'code=-1' "code=$($loginOld.code) msg=$($loginOld.msg)" ($loginOld.code -eq '-1')

$resetUnbound = PostJson '/user/reset-password' @{ email = "nobody$ts@example.com"; code = '123456'; newPassword = 'NewPass123' }
Check 'TC-26' '未绑定邮箱无法重置' 'code=-1' "code=$($resetUnbound.code) msg=$($resetUnbound.msg)" ($resetUnbound.code -eq '-1')

# ---------- 5. 管理员新增重复 ----------
$adminDup = PostJson '/user/' @{ username = "adm$ts"; password = 'Abc12345'; name = '管理员测试'; sex = '男'; email = $email; tel = "197$($ts)33"; role = '巡检员' }
Check 'TC-27' '管理员新增重复邮箱被拒绝' 'code=-1' "code=$($adminDup.code) msg=$($adminDup.msg)" ($adminDup.code -eq '-1')

# ---------- 6. 回归 ----------
$kb = GetJson '/knowledge/stats'
Check 'TC-28' '知识手册接口回归（32 条）' 'total=32' "total=$($kb.data.total)" ($kb.data.total -eq 32)

$img = GetJson '/imgRecords/all'
Check 'TC-29' '检测记录接口回归' 'code=0' "code=$($img.code) count=$($img.data.Count)" ($img.code -eq '0')

$wo = GetJson '/workOrder?pageNum=1&pageSize=1'
Check 'TC-30' '工单接口回归' 'code=0' "code=$($wo.code)" ($wo.code -eq '0')

$ai = GetJson '/ai/status'
Check 'TC-31' '问答状态接口回归' 'code=0, mode=local/online/coze' "code=$($ai.code), mode=$($ai.data.mode)" ($ai.code -eq '0' -and $ai.data.mode -in @('local','online','coze'))

# ---------- 7. 清理 ----------
$del1 = DeleteApi "/user/$userId"
$del2 = DeleteApi "/user/$userId2"
$after = PostJson '/user/login' @{ username = $userName; password = 'NewPass123'; role = '巡检员' }
Check 'TC-32' '测试账号已清理' '登录失败' "del=$($del1.code)/$($del2.code) login=$($after.code)" ($del1.code -eq '0' -and $del2.code -eq '0' -and $after.code -eq '-1')

# ---------- 输出 ----------
$pass = ($results | Where-Object { $_.Result -eq 'PASS' }).Count
$fail = $results.Count - $pass
$lines = @()
$lines += "房建安全系统 · 接口测试报告  ($(Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))"
$lines += "环境：http://localhost:9999  MySQL yoloai  测试账号前缀 qa$ts"
$lines += ("-" * 110)
$lines += ("{0,-7}{1,-34}{2,-44}{3,-8}" -f 'ID', '用例', '预期', '结果')
$lines += ("-" * 110)
foreach ($r in $results) {
	$expected = if ($r.Expected.Length -gt 42) { $r.Expected.Substring(0, 42) } else { $r.Expected }
	$lines += ("{0,-7}{1,-34}{2,-44}{3,-8}" -f $r.ID, $r.Case, $expected, $r.Result)
	if ($r.Result -eq 'FAIL') {
		$lines += ("        实际：" + $r.Actual)
	}
}
$lines += ("-" * 110)
$lines += "合计：$($results.Count) 条，通过 $pass 条，失败 $fail 条"

$report = $lines -join "`r`n"
Write-Output $report
$report | Out-File -FilePath 'D:\workspace\factory\dsh-test\api-test-report.txt' -Encoding utf8
if ($fail -gt 0) { exit 1 } else { exit 0 }
