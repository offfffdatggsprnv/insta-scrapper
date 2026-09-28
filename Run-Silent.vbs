Set WshShell = CreateObject("WScript.Shell")
' Run batch file completely hidden in background (0 = hide window)
WshShell.CurrentDirectory = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
WshShell.Run "node server.js", 0, False
WScript.Sleep 1500
WshShell.Run "http://localhost:3000"
