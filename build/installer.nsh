; Scribe NSIS additions (electron-builder `nsis.include`).
;
; Real uninstalls (Windows Settings → Apps → Uninstall) ask whether to save the
; user's data — history, dictionary, settings (scribe.db / scribe-store.json) —
; to a "Scribe Backup" folder on the Desktop before everything is removed.
;   Yes → back the data files up, then delete the app data.
;   No  → delete everything instantly.
; In-place UPDATES (${isUpdated}) skip all of this and never touch user data.
; Silent uninstalls (/S) default to Yes — the safe choice.

!macro customUnInstall
  ${ifNot} ${isUpdated}
    MessageBox MB_YESNO|MB_ICONQUESTION \
      "Do you want to save your Scribe data (dictations, dictionary, settings) to a 'Scribe Backup' folder on your Desktop before it is deleted?" \
      /SD IDYES IDYES doBackup IDNO removeData
    doBackup:
      CreateDirectory "$DESKTOP\Scribe Backup"
      CopyFiles /SILENT "$APPDATA\Scribe\scribe.db" "$DESKTOP\Scribe Backup"
      CopyFiles /SILENT "$APPDATA\Scribe\scribe.db-wal" "$DESKTOP\Scribe Backup"
      CopyFiles /SILENT "$APPDATA\Scribe\scribe.db-shm" "$DESKTOP\Scribe Backup"
      CopyFiles /SILENT "$APPDATA\Scribe\scribe-store.json" "$DESKTOP\Scribe Backup"
      ; fall through — data is backed up, now remove it like the No branch
    removeData:
      RMDir /r "$APPDATA\Scribe"
  ${endIf}
!macroend
