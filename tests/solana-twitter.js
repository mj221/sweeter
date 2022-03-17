const anchor = require("@project-serum/anchor")
require('chai').use(require('chai-as-promised')).should()
var assert = require('chai').assert
var bs58 = require('bs58')


const {SystemProgram} = anchor.web3

describe("solana-twitter", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.Provider.env()
  anchor.setProvider(provider)
  const program = anchor.workspace.SolanaTwitter

  it("Send new tweet", async () => {
    const tweet = anchor.web3.Keypair.generate()
    await program.rpc.sendTweet('health', 'Eat vegetables!', {
        accounts :{
            tweet: tweet.publicKey,
            author: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
        },
        signers:[tweet],
    })
    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey)
    tweetAccount.author.toBase58().should.equal(program.provider.wallet.publicKey.toBase58())
    tweetAccount.topic.should.equal('health')
    tweetAccount.content.should.equal('Eat vegetables!')
    assert.ok(tweetAccount.timestamp)
  })

  it("Send new tweet without a topic", async () => {
    const tweet = anchor.web3.Keypair.generate()
    await program.rpc.sendTweet('', 'gm', {
        accounts :{
            tweet: tweet.publicKey,
            author: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
        },
        signers:[tweet],
    })
    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey)
    tweetAccount.author.toBase58().should.equal(program.provider.wallet.publicKey.toBase58())
    tweetAccount.topic.should.equal('')
    tweetAccount.content.should.equal('gm')
    assert.ok(tweetAccount.timestamp)

  })
  it("Send new tweet from different author", async () => {
    const otherUser = anchor.web3.Keypair.generate()
    const signature = await program.provider.connection.requestAirdrop(otherUser.publicKey, 1000000000)
    await program.provider.connection.confirmTransaction(signature)

    const tweet = anchor.web3.Keypair.generate()
    await program.rpc.sendTweet('health', 'Eat fruits!', {
        accounts :{
            tweet: tweet.publicKey,
            author: otherUser.publicKey,
            systemProgram: SystemProgram.programId,
        },
        signers:[otherUser, tweet],
    })
    const tweetAccount = await program.account.tweet.fetch(tweet.publicKey)
    tweetAccount.author.toBase58().should.equal(otherUser.publicKey.toBase58())
    tweetAccount.topic.should.equal('health')
    tweetAccount.content.should.equal('Eat fruits!')
    assert.ok(tweetAccount.timestamp)

  })

  it("Cannot provide a topic with more than 50 characters", async () => {
    const tweet = anchor.web3.Keypair.generate()
    const topic = 'x'.repeat(51)
    try{
      await program.rpc.sendTweet(topic, 'CONTENT HERE', {
        accounts :{
            tweet: tweet.publicKey,
            author: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
        },
        signers:[tweet],
      })

    }catch(error){
      assert.equal(error.msg, 'The provided topic should be 50 characters long maximum.')
      return;
    }
    
    assert.fail('The instruction didn\'t fail with 51-character topic.')
  })

  it("Cannot provide a content with more than 280 characters", async () => {
    const tweet = anchor.web3.Keypair.generate()
    const content = 'x'.repeat(281)
    try{
      await program.rpc.sendTweet('TOPIC HERE', content, {
        accounts :{
            tweet: tweet.publicKey,
            author: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
        },
        signers:[tweet],
      })

    }catch(error){
      assert.equal(error.msg, 'The provided content should be 280 characters long maximum.')
      return;
    }
    
    assert.fail('The instruction didn\'t fail with 280-character content.')
  })
  it('can fetch all tweets', async() =>{
    const tweetAccounts = await program.account.tweet.all()
    assert.equal(tweetAccounts.length, 3)
  })

  it('Can filter tweets by author', async() =>{
    const authorPublicKey = program.provider.wallet.publicKey
    const tweetAccounts = await program.account.tweet.all([
      {
        memcmp:{
          offset: 8,  //discriminator of 8 bytes
          bytes: authorPublicKey.toBase58(),
        }
      }

    ])
    assert.equal(tweetAccounts.length, 2)

    tweetAccounts.map((account) => {
      assert.equal(account.account.author.toBase58(), authorPublicKey.toBase58())
    })
  })

  it('Can filter tweets by topic', async() => {
    const tweetAccounts = await program.account.tweet.all([
      {
        memcmp:{
          offset: 8 + 32 + 8 + 4 ,// offset values from smart contract,
          bytes: bs58.encode(Buffer.from('health'))
        }
      }
    ])
    assert.equal(tweetAccounts.length, 2)
    tweetAccounts.map((account) => {
      assert.equal(account.account.topic, "health")
    })
  })


})
