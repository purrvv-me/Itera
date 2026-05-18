#define MyAppName "Itera"
#define MyAppVersion "0.1.0"
#define MyAppPublisher "Itera"
#define MyAppExeName "Itera.exe"

[Setup]
AppId={{F4E72831-1E26-4E69-984F-1E7A00000001}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName={autopf}\Itera
DefaultGroupName=Itera
DisableProgramGroupPage=yes
OutputDir=..\dist\installer
OutputBaseFilename=IteraSetup
Compression=lzma
SolidCompression=yes
WizardStyle=modern
SetupIconFile=..\assets\itera.ico
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional icons:"; Flags: unchecked

[Files]
Source: "..\dist\Itera\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Itera"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\Itera"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "Launch Itera"; Flags: nowait postinstall skipifsilent
