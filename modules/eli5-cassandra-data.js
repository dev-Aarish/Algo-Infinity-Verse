/**
 * ELI5 (Explain Like I'm 5) content for Cassandra Learning Hub lessons.
 * Each key is a module `id`. Value is plain-language HTML with real-world analogies.
 */
(function () {
  'use strict';

  var eli5CassandraData = {
    // ─── Module 1: Cassandra Basics & Architecture ───
    basics: `
      <p>Imagine you're running a <strong>huge lemonade stand</strong> on a hot summer day. If you only had one friend helping you, what happens when they get sick? Your stand closes! That's how regular databases work — they have a single point of failure (one boss).</p>
      <p>Cassandra is different — it's like having <strong>100 friends</strong> all running their own lemonade stands, all selling the same lemonade. If one friend gets sick, no problem! You go to the next stand. Every stand knows exactly what every other stand is doing because they constantly chat with each other (that's the <strong>Gossip Protocol</strong> — like friends passing rumors around).</p>
      <p>Nobody is the boss. Everyone is equal — a <strong>peer-to-peer</strong> team. When you need more capacity, you just add another friend with a new stand. Cassandra grows linearly — twice the stands, twice the lemonade!</p>
    `,

    // ─── Module 2: Partition Keys & Token Ring ───
    partitioning: `
      <p>Imagine you have <strong>a giant mailroom</strong>. Letters come pouring in, and you need to decide which shelf to put each letter on. You could read every letter to decide, but that's way too slow!</p>
      <p>Instead, you take the envelope's <strong>zip code</strong> and run it through a machine that prints a number between 0 and 360. That number tells you exactly where on a <strong>circular shelf</strong> (the Token Ring) the letter goes.</p>
      <p>The <strong>Partition Key</strong> is like the zip code on the envelope. Cassandra takes that key, runs it through a <strong>hashing machine</strong> (like Murmur3 — think of it as a blender that always turns the same ingredient into the same smoothie), and out comes a token number. That token tells Cassandra which "shelf" (node) gets the letter.</p>
      <p>Play with the <strong>Token Ring Visualizer</strong> below! Type in a partition key and see how the hash lands on a specific position on the ring — just like a dart landing on a dartboard!</p>
    `,

    // ─── Module 3: Replication & RF ───
    replication: `
      <p>Let's go back to our lemonade stands. Imagine your <strong>best lemonade recipe</strong> is written on a single piece of paper at Stand #3. What if Stand #3 catches fire? Your recipe is gone forever!</p>
      <p>To prevent this, Cassandra makes <strong>photocopies</strong> of your recipe. If <strong>RF (Replication Factor) = 3</strong>, that means there are <strong>3 copies</strong> of the recipe, each on a different stand. If Stand #3 burns down, you just walk to Stand #4 or Stand #5 and grab a copy.</p>
      <p><strong>Consistency Levels</strong> are like rules for how many friends must agree before you serve a customer:</p>
      <ul>
        <li><strong>CL.ONE</strong> — You ask one friend "is this recipe right?" and if they say yes, you serve. Fast, but they might have an old copy.</li>
        <li><strong>CL.QUORUM</strong> — You ask <em>most</em> of your friends (more than half). If 2 out of 3 agree, you serve. Safe and balanced.</li>
        <li><strong>CL.ALL</strong> — You ask <em>every</em> friend. Super safe, but if one friend is napping (node down), you can't serve anyone!</li>
      </ul>
    `,

    // ─── Module 4: Cassandra Query Language (CQL) ───
    cql: `
      <p>CQL is like <strong>friendly SQL with training wheels</strong>. If you've ever used SQL before, CQL will look very familiar — it has the same <code>SELECT</code>, <code>INSERT</code>, <code>UPDATE</code>, and <code>DELETE</code> commands.</p>
      <p>But here's the twist: Cassandra's data lives on <strong>100 different computers</strong>, not one. So asking "JOIN these two tables together" would be like asking 100 friends to each run halfway across town to compare papers. Way too slow!</p>
      <p>Because of this, CQL has some <strong>house rules</strong>:</p>
      <ul>
        <li><code>WHERE</code> clauses only work on the <strong>Partition Key</strong> or special indexed columns. You can't just filter on any column.</li>
        <li>There are <strong>no JOINs</strong>. You must store related data together in the same table.</li>
        <li>It's designed for <strong>speed</strong> — Cassandra is built to handle millions of writes per second!</li>
      </ul>
      <p>Try typing <code>SELECT * FROM users</code> in the terminal below! It works just like SQL, but remember — under the hood, Cassandra is doing something much more clever.</p>
    `,

    // ─── Module 5: Data Modeling Basics ───
    modeling: `
      <p>Designing a database for Cassandra is like <strong>organizing a potluck dinner</strong>. In a regular database (SQL), you bring ingredients (data) and cook dishes (JOINs) on the spot. In Cassandra, you bring <strong>ready-to-eat dishes</strong> — everything your guests need is already on the plate.</p>
      <p><strong>Rule 1:</strong> "Data that is read together must be stored together." If you always show a user's name AND their email AND their recent orders, put all that info in <strong>one table</strong> within <strong>one row</strong>. No separating! No JOINing later!</p>
      <p><strong>Rule 2:</strong> "Denormalization is your friend." In regular databases, you're told "don't repeat data!" Cassandra says: <strong>Repeat away!</strong> If you need to look up users by country, create a separate table where users are organized by country — even if that means the same user appears in both tables. Extra storage is cheap; slow queries are expensive!</p>
      <p><strong>The Golden Rule:</strong> Think about your queries FIRST, then design your tables. In Cassandra, you don't design tables and then figure out queries — it's the other way around!</p>
    `,

    // ─── Module 6: Knowledge Check ───
    quiz: `
      <p>Let's review what we've learned with some <strong>super simple examples</strong>:</p>
      <p><strong>Q1: What happens if a node goes down in Cassandra?</strong></p>
      <p>Think of it like a <strong>choir with 10 singers</strong>. If one singer loses their voice, the choir keeps singing! The other 9 carry on. Similarly, if one Cassandra node dies, the other nodes keep serving data because they all have copies (thanks to replication).</p>
      <p><strong>Q2: Why are there no JOINs in Cassandra?</strong></p>
      <p>Imagine asking each of your 100 friends to run to a different library, find one specific book, and bring it back to you — <strong>at the same time</strong>. That would be chaos! JOINs require data to live on the same server, but Cassandra spreads data across many servers. So instead of JOINing tables, you store everything you need together upfront — like packing a lunchbox with everything you'll eat instead of running to different stores at lunchtime.</p>
      <p><strong>You did great!</strong> These are the fundamentals that make Cassandra one of the world's most powerful distributed databases.</p>
    `
  };

  window.eli5CassandraData = eli5CassandraData;
})();
