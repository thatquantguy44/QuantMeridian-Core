# 2,000 Scenarios. Same Old History.

*What an interest-rate simulation actually tells you—and how to ask better questions of a very confident-looking chart.*

Give a computer a history of interest rates and ask it to simulate 2,000 possible futures. It will oblige. Ask for 10,000 and it will oblige again.

Computers are wonderfully accommodating that way. The economy has yet to sign the service agreement.

A chart emerges: a line down the middle, shaded bands around it, perhaps a few decimal places to reassure everyone that mathematics has been involved.

There is useful information in that picture. Understanding it starts with a distinction: **more simulated outcomes can make the calculation more precise without adding any new evidence about the world.**

That distinction matters whenever a forecast arrives looking better dressed than its assumptions.

Consider the MCS module—short for Monte Carlo Curve Simulation. Its default run generates 2,000 paths for Treasury yields. The starting point is the yield curve: interest rates arranged by how long it takes a government bond to mature.

The model describes that curve using three moving parts: its overall height, its tilt, and its bend. It estimates how those parts evolved together, then adds surprises sampled from the daily moves its fitted equations did not explain. Each step samples the three components of a historical surprise together.

Repeat that process and you get possible future yields at different maturities and horizons.

That is a useful exercise. It turns a set of assumptions into outcomes you can inspect. You can see a central estimate, a range around it, and how the picture changes when you change the inputs.

But the path counter deserves less reverence than it usually receives.

Going from 2,000 paths to 10,000 gives the model more draws from the same historical shock pool. It does not add another inflation cycle, another policy mistake, or another independent example of a financial crisis.

**More draws. Same evidence.**

Think of repeatedly drawing cards from a deck, putting each card back after you inspect it. More draws help you estimate what is in that deck. They do not establish that tomorrow's game will use the same deck.

The analogy has a limit: a rate model also has fitted dynamics, so its outcomes are more than shuffled copies of past yields. New sequences of familiar shocks can produce unfamiliar outcomes. Even so, the process is constrained by the shocks and relationships it has been given.

A simulation can explore those assumptions very thoroughly. It cannot validate them merely by running longer.

This gives us three different questions to keep separate.

First: have we run enough paths for the reported numbers to settle down? A model's estimated fifth percentile can bounce around because of random sampling. More paths generally help reduce that computational noise.

Second: how much relevant history supports the calculation? Thousands of daily observations may contain relatively few distinct economic episodes. Reusing those observations does not create more episodes.

Third: are the model's rules a useful approximation of what comes next? Fitted relationships can change. Historical surprises may arrive in clusters that the sampling method does not preserve. A model may hold estimated parameters fixed even though those estimates are uncertain.

The first problem is often helped by more computation. The others require better evidence, different assumptions, or an honest account of what remains unknown.

This is also why the shaded band needs careful reading.

In MCS, the outer band runs from the fifth to the ninety-fifth percentile of simulated yields at each displayed future checkpoint. It represents the central 90% of that model-generated distribution.

Whether such a range captures realized yields about 90% of the time is a separate question. You answer it by saving predictions made with information available at the time and comparing them with what subsequently happened.

The shading does not conduct that test for you. Neither does the tasteful color palette.

Even the middle line needs interpretation. Connecting the median at each checkpoint does not necessarily trace any single simulated journey. It joins a series of summaries.

So what should someone actually do with a chart like this?

Use it to make a discussion about uncertainty more specific. Ask which outcomes the assumptions produce, which settings move the result, and which risks the construction leaves outside the picture. For comparing uncertain estimates, a range whose assumptions you can inspect gives you more to interrogate than a lone number.

Then ask four questions:

1. **What history is doing the work?** Look for the dates, the relevant economic environments and how much independent experience they represent.
2. **What stays fixed?** Find out which relationships, parameters or policy assumptions the model treats as given.
3. **What does “90%” refer to?** Is it a share of simulated outcomes, or coverage measured against outcomes the model had not yet seen?
4. **What has been tested?** Ask how the result compares with a simple alternative, using only information available when each prediction was made.

Those questions give a casual market reader a way into the chart. They give an experienced analyst a way to challenge it. And they give the person who built the model something more useful to discuss than the number of paths their laptop survived.

Simulation is valuable because it lets us examine the consequences of assumptions. Its credibility comes from how those assumptions are supported and tested.

The computer can generate another 8,000 scenarios before lunch. It still cannot generate another past.

---

*Source note: The MCS mechanics described here follow the inspected implementation. The three-factor yield-curve approach has a research foundation in [Diebold and Li's work on level, slope and curvature](https://rodneywhitecenter.wharton.upenn.edu/wp-content/uploads/2014/04/0404.pdf). This article explains the construction and interpretation of simulations; it presents no measured forecasting-performance result for MCS.*
