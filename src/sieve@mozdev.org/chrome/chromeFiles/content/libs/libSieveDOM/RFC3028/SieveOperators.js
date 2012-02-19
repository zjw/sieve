/******************************************************************************/

// Unary operators
SieveOperatorSingle.isElement
  = function(token)
{ 
  if (token.substring(0,3).toLowerCase().indexOf("not") == 0)
    return true;

  return false;
}

function SieveOperatorSingle(id) 
{
  // first line with deadcode
  SieveAbstractElement.call(this,id);
  
  this.whiteSpace = []
  this.whiteSpace[0] = SieveLexer.createByName("whitespace");
  this.whiteSpace[1] = SieveLexer.createByName("whitespace");
 // this.test = SieveLexer.createByName("operator");
}

SieveOperatorSingle.prototype.__proto__ = SieveAbstractElement.prototype;

SieveOperatorSingle.prototype.init
    = function (data)
{
  // Syntax :
  // <"not"> <tests: test-list>
  
  data = data.slice("not".length);  
  data = this.whiteSpace[0].init(data);  
    
  if (SieveLexer.probeByClass(["test"],data) == false) 
    throw "Test command expected but found:\n'"+data.substr(0,50)+"'...";                 

  this.test = SieveLexer.createByClass(["test"],data)
  data = this.test.init(data);
    
  if (SieveLexer.probeByName("whitespace",data))
    data = this.whiteSpace[1].init(data);  
  
  return data;
    
}    

SieveOperatorSingle.prototype.toScript
    = function ()
{
  return "not"
    + this.whiteSpace[0].toScript()
    + this.test.toScript()
    + this.whiteSpace[1].toScript();
}

SieveOperatorSingle.prototype.toWidget
    = function()
{
  var elm = $("<div/>");
  
  elm.text("does not match:");
          
  elm.append(
    (new SieveDropBoxUI(this.id,this.test))/*.flavours("sieve/test")*/.getWidget());
    

  elm.append(this.test.toWidget())
  
  elm.append(
    (new SieveDropBoxUI(this.id))/*.flavours("sieve/test")*/.getWidget());
  
  return elm;   
}


//****************************************************************************//

if (!SieveLexer)
  throw "Could not register Conditional Elements";


SieveLexer.register2("test","test/not",SieveOperatorSingle);
            
