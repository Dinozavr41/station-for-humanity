// Station for Humanity — LeadBot Google Sheets adapter
// Deploy as a Google Apps Script Web App. Set Script Property SFH_SHARED_KEY.
// Use the deployment URL with ?key=<same value> and save that full URL in LeadBot Vault.

function doPost(e) {
  try {
    var expected = PropertiesService.getScriptProperties().getProperty('SFH_SHARED_KEY');
    var supplied = e && e.parameter ? String(e.parameter.key || '') : '';
    if (!expected || supplied !== expected) {
      return json_({ ok: false, error: 'unauthorized' });
    }

    var payload = JSON.parse((e.postData && e.postData.contents) || '{}');
    if (payload.schema !== 'sfh/leadbot-lead/v1' || !payload.lead) {
      return json_({ ok: false, error: 'invalid_payload' });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName('Leads') || ss.insertSheet('Leads');
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Received at', 'Instance', 'Business', 'Lead #', 'Flow', 'Contact', 'Estimate', 'Answers JSON', 'Created at']);
    }

    var lead = payload.lead || {};
    var estimate = lead.estimate && lead.estimate.available
      ? String(lead.estimate.amount || '') + ' ' + String(lead.estimate.currency || '')
      : '';

    sheet.appendRow([
      new Date(),
      String(payload.instance || ''),
      String(payload.business || ''),
      String(lead.number || ''),
      String(lead.flow_code || ''),
      String(lead.contact || ''),
      estimate,
      JSON.stringify(lead.answers || {}),
      String(lead.created_at || '')
    ]);

    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function json_(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
