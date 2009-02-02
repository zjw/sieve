/* 
 * The contents of this file is licenced. You may obtain a copy of
 * the license at http://sieve.mozdev.org or request it via email 
 * from the author. Do not remove or change this comment. 
 * 
 * The initial author of the code is:
 *   Thomas Schmid <schmid-thomas@gmx.net>
 */
 
// Hints for Spekt IDE autocomplete...
//@include "/sieve/src/sieve@mozdev.org/chrome/chromeFiles/content/libs/libManageSieve/SieveAccounts.js"
//@include "/sieve/src/sieve@mozdev.org/chrome/chromeFiles/content/libs/libManageSieve/Sieve.js"
  // TODO make sure that the scripts are imported only once.
  // TODO place imports in the corresponding files like the header import in c...
  
  // TODO Move "imports" to xul...
  // Load all the Libraries we need...
  var jsLoader = Components
                   .classes["@mozilla.org/moz/jssubscript-loader;1"]
                   .getService(Components.interfaces.mozIJSSubScriptLoader);
  jsLoader
    .loadSubScript("chrome://sieve/content/libs/libManageSieve/SieveAccounts.js");
  jsLoader
    .loadSubScript("chrome://sieve/content/libs/libManageSieve/Sieve.js");
  jsLoader
    .loadSubScript("chrome://sieve/content/libs/libManageSieve/SieveWatchDog.js");    
  jsLoader
    .loadSubScript("chrome://sieve/content/libs/libManageSieve/SieveRequest.js");
  jsLoader
    .loadSubScript("chrome://sieve/content/libs/libManageSieve/SieveResponse.js");    
  jsLoader
    .loadSubScript("chrome://sieve/content/libs/libManageSieve/SieveResponseParser.js");        
  jsLoader
    .loadSubScript("chrome://sieve/content/libs/libManageSieve/SieveResponseCodes.js");
  jsLoader
    .loadSubScript("chrome://sieve/content/editor/SieveFiltersTreeView.js");

  // we are done importing script, so free ... 
  // ... the loader inorder to prevent XPCOM leaks
  jsLoader = null;

/** @type {Sieve} */
var gSieve = null;
/** @type {SieveWatchDog} */
var gSieveWatchDog = null;

// contains a [@mozilla.org/consoleservice;1] interface
var gLogger = null; 
 
var sieveTreeView = null;
var closeTimeout = null;
var accounts = new Array();



var event = 
{	
  onAuthenticate: function(response)
  {
    sivSetStatus(3,"Authenticating...");
    var account =  getSelectedAccount();
    
    // Without a username, we can skip the authentication 
    if (account.getLogin().hasUsername() == false)
    {
      event.onLoginResponse(null);
      return;
    }


    // We have to figure out which ist the best SASL Mechanism for the login ...
    // ... therefore we check first whether a mechanism is forced by the user ...
    // ... if no one is specified, we follow the rfc advice and use the first 
    // .... mechanism listed in the capability response.
    var mechanism = null;        
    if (account.getSettings().hasForcedAuthMechanism())
      mechanism = account.getSettings().getForcedAuthMechanism();
    else
      mechanism = response.getSasl()[0];

    document.getElementById('txtSASL').value
        = response.getSasl();
    document.getElementById('txtExtensions').value    
        = response.getExtensions(); 
    document.getElementById('txtImplementation').value 
        = response.getImplementation();
    document.getElementById('txtVersion').value
        = response.getVersion();
          
    // ... translate the SASL Mechanism String into an SieveSaslLogin Object ...
    var request = null;  
    switch (mechanism.toLowerCase())
    {
      case "login":
        request = new SieveSaslLoginRequest();      
  	    request.addSaslLoginListener(event);
        break;
      case "plain":
      default: // plain is always the fallback...
        request = new SieveSaslPlainRequest();
   	    request.addSaslPlainListener(event); 	    
        break;        
    }

    request.addErrorListener(event);
    request.setUsername(account.getLogin().getUsername())
    
    var password = account.getLogin().getPassword();
    
    // TODO: terminate connection in case of an invalid password
    // and notify the user
    if (password == null)
    {
      sivSetStatus(2, "Error: Unable to retrieve Authentication information.");
      return;
    }
      
    request.setPassword(password);
    
    // check if the authentication method supports proxy authorization...
    if (request.isAuthorizable())
    {
      // ... if so retrieve the authorization identity   
      var authorization = account.getAuthorization().getAuthorization();
      // TODO: terminate connection an notify that authorization settings
      // are invalid...
      if (authorization == null)
      {
        sivSetStatus(2, "Error: Unable to retrieve Authorization information");
        return;
      }
      
      request.setAuthorization(authorization);
    }
     
    gSieve.addRequest(request);    		
    
  },
  
  onInitResponse: function(response)
  {
    // establish a secure connection if TLS ist enabled and if the Server ...
    // ... is capable of handling TLS, otherwise simply skip it and ...
    // ... use an insecure connection
    
    gSieve.setCompatibility(response.getVersion());
    
    if (getSelectedAccount().getHost().isTLS() && response.getTLS())
    {
      var request = new SieveStartTLSRequest();
      request.addStartTLSListener(event);
      request.addErrorListener(event);
      
      gSieve.addRequest(request);
      return;
    }
    
    event.onAuthenticate(response);
  },

  onStartTLSResponse : function(response)
  {
    
    // workaround for timsieved bug...
    var lEvent = 
    {        
      onInitResponse: function(response)
      {
        sivSetStatus(3,"Starting TLS (Strict RFC)");
        
        gSieveWatchDog.setTimeoutInterval();
        event.onAuthenticate(response);
      },
      
      onError: function(response)
      {
        gSieveWatchDog.setTimeoutInterval();
        alert("Error");
        event.onError(response);
      },
      
      onTimeout: function()
      {
        sivSetStatus(3,"Starting TLS (Cyrus compatibility)");
        
        gSieveWatchDog.setTimeoutInterval();
        var request = new SieveCapabilitiesRequest();
        request.addCapabilitiesListener(event);
        request.addErrorListener(event);	
		
        gSieve.addRequest(request);
      }    	
    }
    	  
    // after calling startTLS the server will propagate his capabilities...
    // ... like at the login, therefore we reuse the SieveInitRequest
    
    // some revision of timsieved fail to resissue the capabilities...
    // ... which causes the extension to be jammed. Therefore we have to ...
    // ... do a rather nasty workaround. The jammed extension causes a timeout,
    // ... we catch this timeout and continue as if nothing happend...
    
    var compatibility = getSelectedAccount().getSettings().getCompatibility(); 
    
    switch (compatibility.getHandshakeMode())
    {
      case 0:
        sivSetStatus(3,"Autodetecting TLS Handshake...");      
        var request = new SieveInitRequest();
        request.addInitListener(lEvent);
        request.addErrorListener(lEvent);
        
        gSieveWatchDog.setTimeoutInterval(compatibility.getHandshakeTimeout());
        gSieve.addRequest(request);
    
        gSieve.startTLS(true);   
        break;
        
      case 1:
        sivSetStatus(3,"Starting TLS (Strict RFC)");
             
        var request = new SieveInitRequest();
        request.addInitListener(lEvent);
        request.addErrorListener(event);  
        gSieve.addRequest(request);
    
        // activate TLS
        gSieve.startTLS(true);
        
        break;
      case 2:
        sivSetStatus(3,"Starting TLS (Cyrus compatibility)");
      
        gSieve.startTLS(true);
      
        var request = new SieveCapabilitiesRequest();
        request.addCapabilitiesListener(event);
        request.addErrorListener(event);  
    
        gSieve.addRequest(request);
        break;
    }
  },
	
  onSaslLoginResponse: function(response)
  {
    event.onLoginResponse(response);
  },

	
  onSaslPlainResponse: function(response)
  {
    event.onLoginResponse(response);
  },
	
  onLoginResponse: function(response)
  {
    // enable the disabled controls....
    disableControls(false);
    postStatus("Connected");
		
    // List all scripts as soon as we are connected
    var request = new SieveListScriptRequest();
    request.addListScriptListener(event);
    request.addErrorListener(event);

    gSieve.addRequest(request);
    disableControls(false);
    sivSetStatus(4);
  },
	
  onLogoutResponse: function(response)
  {
    clearTimeout(closeTimeout);
    
    sivDisconnect();
    // this will close the Dialog!
    close();
  },

  onListScriptResponse: function(response)
  {
    sieveTreeView.update(response.getScripts());
    
    var tree = document.getElementById('treeImapRules');
    tree.view = sieveTreeView;
    
    // always select something
    if ((tree.currentIndex < 0) && (tree.view.rowCount > 0))
      tree.view.selection.select(0);
  },

  onSetActiveResponse: function(response)
  {
    // Always refresh the table ...
    var request = new SieveListScriptRequest();
    request.addListScriptListener(event);
    request.addErrorListener(event);
    
    gSieve.addRequest(request);
  },

  onDeleteScriptResponse:  function(response)
  {
    // Always refresh the table ...
    var request = new SieveListScriptRequest();
    request.addListScriptListener(event);
    request.addErrorListener(event);
    
    gSieve.addRequest(request);
  },
  
  onCapabilitiesResponse: function(response)
  {
    event.onAuthenticate(response);
  },

  onTimeout: function()
  {
    disableControls(true);
    sivSetStatus(1, "The connection has timed out, the Server is not responding...");
    postStatus("Disconnected");
    
    sivDisconnect();
  },
	
  onError: function(response)
  {
    var code = response.getResponseCode();

    if (code instanceof SieveRespCodeReferral)
    {
      disableControls(true);
      // close the old sieve connection
      sivDisconnect();
        
      postStatus("Referral to "+code.getHostname()+" ...");
      
      var account = getSelectedAccount();

      sivConnect(account,code.getHostname());
      
      return;
    }

    sivSetStatus(2, "Action failed, server reported an error...\n"+response.getMessage());
  },
  
  onCycleCell: function(row,col,script,active)
  {
  	var request = null;
    if (active == true)
      request = new SieveSetActiveRequest();
    else
      request = new SieveSetActiveRequest(script)
      
    request.addSetActiveListener(event);
    request.addErrorListener(event);
    
    gSieve.addRequest(request);
  },
  
  onIdle: function ()
  { 
    // as we send a keep alive request, we don't care
    // about the response...
    var request = new SieveCapabilitiesRequest();
    request.addErrorListener(event);
  
    gSieve.addRequest(request);
  },
    
  onWatchDogTimeout : function()
  {
    // call sieve object indirect inoder to prevent a 
    // ring reference
    gSieve.onWatchDogTimeout();
  }    
}

function onWindowLoad()
{

//	var actList = document.getElementById("conImapAcct");
//	var actpopup = document.createElement("menupopup");
//	actList.appendChild(actpopup);

  // now create a logger session...
  if (gLogger == null)
  {
    gLogger = Components.classes["@mozilla.org/consoleservice;1"]
                    .getService(Components.interfaces.nsIConsoleService);
  }

  var menuImapAccounts = document.getElementById("menuImapAccounts");

  accounts = (new SieveAccounts()).getAccounts();

  for (var i = 0; i < accounts.length; i++)
  {   
    if (accounts[i].isEnabled() == false)
      menuImapAccounts.appendItem( accounts[i].getDescription(),"","- disabled").disabled = true;
    else
      menuImapAccounts.appendItem( accounts[i].getDescription(),"","").disabled = false;

    if (window.arguments.length == 0)
      continue;
    
    if (window.arguments[0].server != accounts[i].getUri())
      continue;
      
    menuImapAccounts.selectedIndex = i;      
  }
	
  sieveTreeView = new SieveTreeView(new Array(),event);	
  document.getElementById('treeImapRules').view = sieveTreeView;
	
	if (menuImapAccounts.selectedIndex == -1)
    menuImapAccounts.selectedIndex = 0;
    
  onSelectAccount();
}
   
function onWindowClose()
{
  // unbind the logger inoder to prevent xpcom memory holes
  gLogger = null;
  
  if (gSieve == null)
    return true;
  
  // Force disconnect in 500 MS
  closeTimeout = setTimeout("sivDisconnect(); close();",250);

  var request = new SieveLogoutRequest(event)
  request.addLogoutListener(event);
  request.addErrorListener(event)
  
  gSieve.addRequest(request);

  return false;
}   
/**
 * XXX
 * @return {SieveAccount}
 */
//sivGetActiveAccount()
function getSelectedAccount()
{
  var menu = document.getElementById("menuImapAccounts") 
  
  if (menu.selectedIndex <0)
    return null;
  
  return accounts[menu.selectedIndex];
}

function sivConnect(account,hostname)
{
  postStatus("Connecting...");
  sivSetStatus(3,"Connecting...");
  
  if (hostname == null)
    hostname = account.getHost().getHostname();

  // when pathing this lines always keep refferal code in sync
      gSieve = new Sieve(
                    hostname,
                    account.getHost().getPort(),
                    account.getHost().isTLS(),
                    (account.getSettings().isKeepAlive() ?
                        account.getSettings().getKeepAliveInterval():
                        null));

      gSieve.setDebugLevel(
               account.getSettings().getDebugFlags(),
               gLogger);                

      var request = new SieveInitRequest();
      request.addErrorListener(event)
      request.addInitListener(event)
      gSieve.addRequest(request);
      
      gSieveWatchDog = new SieveWatchDog();
      // TODO load Timeout interval from account settings...
      gSieveWatchDog.setTimeoutInterval(20000);
      gSieveWatchDog.addListener(event);  
      
      gSieve.addWatchDogListener(gSieveWatchDog);       
      gSieve.connect();  
}

function onActivateClick()
{
  var tree = document.getElementById('treeImapRules');  
  if (tree.currentIndex < 0)
    return;

  // imitate klick in the treeview
  tree.view.cycleCell(tree.currentIndex,tree.columns.getColumnAt(1));
    
  return;
}

function sivDisconnect()
{
  if (gSieve == null)
    return;
    
  /*if (gSieve.isAlive() == false)
    return;*/    
    
  gSieve.removeWatchDogListener();    
  gSieve.disconnect();
  
  gSieve = null;  
  gSieveWatchDog = null;
}

function onSelectAccount()
{	
  // Override the response handler. We should always logout before reconnecting...
  var levent = 
  {
    onLogoutResponse: function(response)
    {
      
      sivDisconnect();
      
      // update the TreeView...
      var tree = document.getElementById('treeImapRules');
      
      tree.view.selection.clearSelection();
      
      sieveTreeView.update(new Array());
      tree.view = sieveTreeView;
      
      var account = getSelectedAccount();
      
      if (account == null)
        sivSetStatus(2,"Fatal error no account selected...");
      
      disableControls(true);
      // Disable and cancel if account is not enabled
      if (account.isEnabled() == false)
      {
        postStatus("Not connected! Goto 'Tools -> Sieve Settings' to activate this account")
        return;
      }			
      sivConnect(account);
    }
  }
  
  // Besteht das Objekt überhaupt bzw besteht eine Verbindung?
  if ((gSieve == null) || (gSieve.isAlive() == false))
  {
    // ... no sieve object, let's simulate a logout...
    setTimeout(function() {levent.onLogoutResponse("");},10);
    //levent.onLogoutResponse("");
    return;
  }
  
  // hier haben wir etwas weniger Zeit ...
  // TODO: can be removed as timeout are implemented via the watchdog ?!?
  //logoutTimeout = setTimeout(levent.onLogoutResponse,250);
  
  var request = new SieveLogoutRequest();
  request.addLogoutListener(levent);
  request.addErrorListener(event);
  gSieve.addRequest(request);	
}

function onDeleteClick()
{
  var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                  .getService(Components.interfaces.nsIPromptService);
  	
  var check = {value: false};                  // default the checkbox to false
 
  var flags = prompts.BUTTON_POS_0 * prompts.BUTTON_TITLE_YES +
              prompts.BUTTON_POS_1 * prompts.BUTTON_TITLE_NO;

  // The checkbox will be hidden, and button will contain the index of the button pressed,
  // 0, 1, or 2.

  var button = prompts.confirmEx(null, "Confirm Delete", "Do you want to delete the selected script?",
                               flags, "", "", "", null, check);
  
  if (button != 0)
    return;
  
  var tree = document.getElementById('treeImapRules');
  
  if (tree.currentIndex == -1)
    return;
  
  var scriptName = new String(tree.view.getCellText(tree.currentIndex, tree.columns.getColumnAt(0)));	
  
  // delete the script...
  var request = new SieveDeleteScriptRequest(scriptName);
  request.addDeleteScriptListener(event);
  request.addErrorListener(event);
  
  gSieve.addRequest(request);
}
/**
 * XXX
 * @param {String} scriptName
 * @param {String} scriptBody
 */
function sivOpenEditor(scriptName,scriptBody)
{
  // The scope of listners is bound to a window. This makes passing the Sieve...
  // ... object to an other window difficult. At first we have to deattach the... 
  // ... listener, then pass the object, and finally attach a new listern of...
  // ... the new window   
  gSieve.removeWatchDogListener();
  
  var args = new Array();
  args["scriptName"] = scriptName;
  args["scriptBody"] = scriptBody;
  args["sieve"] = gSieve;
  args["compile"] = getSelectedAccount().getSettings().hasCompileDelay();
  args["compileDelay"] = getSelectedAccount().getSettings().getCompileDelay();

  window.openDialog("chrome://sieve/content/editor/SieveFilterEditor.xul", 
                    "SieveFilterEditor", 
                    "chrome,modal,titlebar,resizable,centerscreen", args);

  gSieve.addWatchDogListener(gSieveWatchDog);
  var request = new SieveListScriptRequest();
  request.addListScriptListener(event);
  request.addErrorListener(event);
  
  gSieve.addRequest(request);
  
  return;  
}


function onNewClick()
{
  // Instead of prompting for the scriptname, setting the scriptname to an 
  // unused scriptname (eg. unnamed+000]) would offer a better workflow...
  // Also put a template script would be good...

  var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                  .getService(Components.interfaces.nsIPromptService);

  var input = {value:"unnamed"};
  var check = {value:false};

  var result
       = prompts.prompt(
           window,
           "Create a new Script",
           "Enter the name for your new Sieve script (existing scripts will be overwritten)",
           input, null, check);

  // Did the User cancel the dialog?
  if (result != true)
    return;

  var date = new Date();
  var script = "#\r\n# "+date.getFullYear()+"-"+(date.getMonth()+1)+"-"+date.getDate()+"\r\n#\r\n";
  sivOpenEditor(input.value,script);	
}

function onEditClick()
{
  var tree = document.getElementById('treeImapRules');	
  if (tree.currentIndex < 0)
    return;

  var scriptName = new String(tree.view.getCellText(tree.currentIndex, tree.columns.getColumnAt(0)));
   
  sivOpenEditor(scriptName);
    
  return;
}

function sivSetStatus(state, message)
{
  document.getElementById('sivExplorerWarning').setAttribute('hidden','true');
  document.getElementById('sivExplorerError').setAttribute('hidden','true');
  document.getElementById('sivExplorerWait').setAttribute('hidden','true');
  document.getElementById('sivExplorerTree').setAttribute('collapsed','true');
  
  switch (state)
  {
    case 1: document.getElementById('sivExplorerWarning').removeAttribute('hidden');
            document.getElementById('sivExplorerWarningMsg')
                .firstChild.nodeValue = message;
            break;
    case 2: document.getElementById('sivExplorerError').removeAttribute('hidden');
            document.getElementById('sivExplorerErrorMsg')
                .firstChild.nodeValue = message;    
            break;
    case 3: document.getElementById('sivExplorerWait').removeAttribute('hidden');
            document.getElementById('sivExplorerWaitMsg')
                .firstChild.nodeValue = message;    
            break;
    case 4: document.getElementById('sivExplorerTree').removeAttribute('collapsed');
            break
  }
  
}

function postStatus(message)
{
  document.getElementById('sbStatus').label = message;
}

function disableControls(disabled)
{
  if (disabled)
  {    
    document.getElementById('newButton').setAttribute('disabled','true');
    document.getElementById('editButton').setAttribute('disabled','true');
    document.getElementById('deleteButton').setAttribute('disabled','true');
    document.getElementById('renameButton').setAttribute('disabled','true');   
    document.getElementById('btnActivateScript').setAttribute('disabled','true');
    document.getElementById('treeImapRules').setAttribute('disabled','true');
    document.getElementById('btnServerDetails').setAttribute('disabled','true');
    document.getElementById('vbServerDetails').setAttribute('hidden','true');
  }
  else
  {    
    document.getElementById('newButton').removeAttribute('disabled');
    document.getElementById('editButton').removeAttribute('disabled');
    document.getElementById('deleteButton').removeAttribute('disabled');
    document.getElementById('btnActivateScript').removeAttribute('disabled');
    document.getElementById('renameButton').removeAttribute('disabled');
    document.getElementById('treeImapRules').removeAttribute('disabled');
    document.getElementById('btnServerDetails').removeAttribute('disabled');      
  }
}

function sivRename2(oldName, newName)
{
  var lEvent = 
  {    
    onRenameScriptListener: function(response)
    {
      var request = new SieveListScriptRequest();
      request.addListScriptListener(event);
      request.addErrorListener(event);
  
      gSieve.addRequest(request);            
    }
  }
  
  var request = new SieveRenameScriptRequest(oldName, newName);
  request.addRenameScriptListener(lEvent)
  request.addErrorListener(event);
    
  gSieve.addRequest(request)
}

function sivRename(oldName, newName, isActive)
{
  var lEvent = 
  {
    oldScriptName  : null,    
    newScriptName  : null,
    isActive       : null,
    
    onGetScriptResponse: function(response)
    {
      var request = new SievePutScriptRequest(
                      new String(lEvent.newScriptName),
                      new String(response.getScriptBody()));

      request.addPutScriptListener(lEvent)
      request.addErrorListener(event)
      gSieve.addRequest(request);  
    },    
    onPutScriptResponse: function(response)
    {
      
      if (lEvent.isActive == true)
      {
        var request = new SieveSetActiveRequest(lEvent.newScriptName)
      
        request.addSetActiveListener(lEvent);
        request.addErrorListener(event);
    
        gSieve.addRequest(request);
      }
      else
        lEvent.onSetActiveResponse(null);
    },
    onSetActiveResponse: function(response)
    {
      // we redirect this request to event not lEvent!
      // because event.onDeleteScript is doing exactly what we want!
      var request = new SieveDeleteScriptRequest(lEvent.oldScriptName);
      request.addDeleteScriptListener(event);
      request.addErrorListener(event);
      gSieve.addRequest(request);
    }     
  }
  
  lEvent.oldScriptName  = oldName;
  lEvent.newScriptName  = newName;
  lEvent.isActive =  (isActive=="true"?true:false);
      
  // first get the script and redirect the event to a local event...
  // ... in order to put it up under its new name an then finally delete it
  var request = new SieveGetScriptRequest(lEvent.oldScriptName);

  request.addGetScriptListener(lEvent);
  request.addErrorListener(event);

  gSieve.addRequest(request);   
}

function onRenameClick()
{
  
  var tree = document.getElementById('treeImapRules');

  if (tree.currentIndex == -1)
    return;
   
  var oldScriptName = new String(tree.view.getCellText(tree.currentIndex, tree.columns.getColumnAt(0)));
  
  // TODO remember if the Script is active
  var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
                  .getService(Components.interfaces.nsIPromptService);

  var input = {value:oldScriptName};
  var check = {value:false};

  var result
       = prompts.prompt(
           window,
           "Rename Sieve Script",
           "Enter the new name for your Sieve script ",
           input, null, check);

  // Did the User cancel the dialog?
  if (result != true)
    return;
  
  // it the old name equals the new name, ignore the request.
  if (input.value.toLowerCase() == oldScriptName.toLowerCase())
    return;   

  if (gSieve.getCompatibility() >=1)
   sivRename2(oldScriptName, input.value);
  else
   sivRename(oldScriptName, input.value, 
     tree.view.getCellValue(tree.currentIndex, tree.columns.getColumnAt(1)));   
}

function onServerDetails()
{
  var el = document.getElementById("vbServerDetails");  
  var img = document.getElementById("imgServerDetails");
    
  if (el.hidden == true)
  {    
    el.removeAttribute('hidden');
    img.setAttribute('src','chrome://global/skin/tree/twisty-clsd.png');
  }
  else
  {
    el.setAttribute('hidden','true');
    img.setAttribute('src','chrome://global/skin/tree/twisty-open.png');
  }  
}

function onSettingsClick()
{
 var server = Components.classes['@mozilla.org/messenger/account-manager;1']
                   .getService(Components.interfaces.nsIMsgAccountManager)
                   .getIncomingServer(getSelectedAccount().imapKey);
                      
  gSivExtUtils.OpenSettings(server);
}


