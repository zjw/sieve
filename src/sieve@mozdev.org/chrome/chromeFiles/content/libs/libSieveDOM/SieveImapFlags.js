/* 
 * The contents of this file is licenced. You may obtain a copy of
 * the license at http://sieve.mozdev.org or request it via email 
 * from the author. Do not remove or change this comment. 
 * 
 * The initial author of the code is:
 *   Thomas Schmid <schmid-thomas@gmx.net>
 */
 
// setflag <variablename: string> <list-of-flags: string-list>

function SieveSetFlag(id) 
{
  this.id = id;
  
  this.whiteSpace = SieveLexer.createByName("whitespace");
  this.flaglist = SieveLexer.createByName("stringlist");
  this.semicolon = SieveLexer.createByName("atom/semicolon");
}

SieveSetFlag.prototype.init
    = function (data)
{  
  data = data.slice("setflag".length);
  
  // ... eat the deadcode before the string...
  data = this.whiteSpace.init(data);
      
  data = this.flaglist.init(data)

  data = this.semicolon.init(data);
    
  return data;
}

SieveSetFlag.prototype.toScript
    = function ()
{
  return "setflag"
    + this.whiteSpace.toScript()
    + this.flaglist.toScript()
    + this.semicolon.toScript();
}

/******************************************************************************/

//addflag <variablename: string> <list-of-flags: string-list>

function SieveAddFlag(id) 
{
  this.id = id;
  
  this.whiteSpace = [];
  this.whiteSpace[0] = SieveLexer.createByName("whitespace");
  this.whiteSpace[1] = SieveLexer.createByName("whitespace");  
                
  this.flaglist = new SieveStringList(this.id);
}

SieveAddFlag.prototype.init
    = function (data)
{
  // Syntax :
  // <"fileinto"> <string> <";">
  
  data = data.slice("addflag".length);
  
  // ... eat the deadcode before the string...
  data = this.whiteSpace[0].init(data);
  
  data = this.flaglist.init(data)

  data = this.whiteSpace[1].init(data);
    
  // ... and finally remove the semicolon;
  if (data.charAt(0) != ";")
    throw "Syntaxerror: Semicolon expected";
    
  return data.slice(1);
}

SieveAddFlag.prototype.toScript
    = function ()
{
  return "addflag"
    + this.whiteSpace[0].toScript()
    + this.flaglist
    + this.whiteSpace[1].toScript()        
    + ";";
}

/******************************************************************************/

//removeflag <variablename: string> <list-of-flags: string-list>

SieveRemoveFlag.isRemoveFlag
  = function(token)
{ 
 if (token.indexOf("removeflag") == 0)
    return true;
 
 return false;
}

function SieveRemoveFlag(id) 
{
  this.id = id;
  
  this.whiteSpace = [];
  this.whiteSpace[0] = SieveLexer.createByName("whitespace");
  this.whiteSpace[1] = SieveLexer.createByName("whitespace");  
                
  this.flaglist = new SieveStringList();
}

SieveRemoveFlag.prototype.init
    = function (data)
{
  // Syntax :
  // <"fileinto"> <string> <";">
  
  data = data.slice("removeflag".length);
  
  // ... eat the deadcode before the string...
  data = this.whiteSpace[0].init(data);
      
  data = this.flaglist.init(data)

  data = this.whiteSpace[1].init(data);
    
  // ... and finally remove the semicolon;
  if (data.charAt(0) != ";")
    throw "Syntaxerror: Semicolon expected";
    
  return data.slice(1);
}

SieveRemoveFlag.prototype.toScript
    = function ()
{
  return "removeflag"
    + this.whiteSpace[0].toScript()
    + this.flaglist
    + this.whiteSpace[1].toScript()        
    + ";";
}


/******************************************************************************/

//hasflag [MATCH-TYPE] <variable-list: string-list> <list-of-flags: string-list>

// REGISTER

SieveHasFlag.isHasFlag
  = function(token)
{ 
 if (token.indexOf("hasflag") == 0)
    return true;
 
 return false;
}
 
function SieveHasFlag(id)
{
  this.id = id;

  this.whiteSpace = [];
  this.whiteSpace[0] = SieveLexer.createByName("whitespace");
  this.whiteSpace[1] = SieveLexer.createByName("whitespace");
  this.whiteSpace[2] = SieveLexer.createByName("whitespace");    


  this.whiteSpace     = new Array();
  this.matchType      = null;
  this.flagList       = new SieveStringList();
}

SieveHasFlag.prototype.init
    = function (data)
{
  data = data.slice("hasflag".length);
  
  this.whiteSpace[0].init(data)
  
  if (isSieveMatchType(data))
  {
    this.matchType = new SieveMatchType();
    data = this.matchType.init(data);
    
    data = this.whiteSpace[1].init(data);    
  }
  
  data = this.flagList.init(data);
  data = this.whiteSpace[2].init(data);
      
  return data;
}    

SieveHasFlag.prototype.toScript
    = function ()
{
  return "hasflag"
    + this.whiteSpace[0].toScript()
    + ((this.matchType != null)?this.matchType[0].toScript():"")
    + ((this.matchType != null)?this.whiteSpace[1].toScript():"")
    + this.flagList.toScript()
    + this.whiteSpace[2].toScript();
}

/******************************************************************************/
/*
if (!SieveLexer)
  throw "Could not register IMAP Flags";

SieveLexer.register("action","action/addflag",
      function(token) {
        return (token.substring(0,7).toLowerCase().indexOf("addflag") == 0)}, 
      function(id) {return new SieveAddFlag(id)});
      
SieveLexer.register("action","action/removeflag",
      function(token) {return SieveRemoveFlag.isRemoveFlag(token)}, 
      function(id) {return new SieveRemoveFlag(id)});  
      
SieveLexer.register("action","action/setflag",
      function(token) {
        return (token.substring(0,7).toLowerCase().indexOf("setflag") == 0)},
      function(id) {return new SieveSetFlag(id)});
      
SieveLexer.register("test","test/hasflag",
      function(token) {return SieveHasFlag.isHasFlag(token)},
      function(id) {return new SieveHasFlag(id)});
*/  