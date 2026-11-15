# 2,000 Scenarios. Same Old History.

*What an interest-rate simulation tells you, and the questions worth asking before you trust the chart.*

Give a computer a history of interest rates and ask it to simulate 2,000 possible futures. It will oblige. Ask for 10,000 and it will oblige again.

The historical record will remain stubbornly unimpressed.

Out comes a chart: a line down the middle, shaded bands around it, perhaps a few decimal places to reassure everyone that mathematics has been involved.

There is useful information in that picture. Reading it well starts with one distinction:

> More simulated outcomes can make a calculation more precise without adding any new evidence about the world.

Consider MCS, short for Monte Carlo Curve Simulation. Its default run generates 2,000 paths for Treasury yields. The starting point is the yield curve: government borrowing rates arranged by maturity, from short-term debt to bonds repaid decades from now.

At its core, the model describes that curve using three moving parts: its overall height, its tilt, and its bend. It estimates how those parts evolved together, then adds surprises sampled from its historical fitting errors. Each step draws the three components of a historical surprise together.

Repeat the process and you get possible future yields across maturities and horizons. A 10-year maturity describes the bond; a three-month horizon describes how far ahead the model is looking. Those are different dimensions of the same chart.

This is useful. It turns assumptions into outcomes you can inspect: a central estimate, a range around it, and a way to examine how the picture responds to different inputs.

But the path counter deserves less reverence than it receives.

Going from 2,000 paths to 10,000 gives the model more draws from the same historical shock pool. It does not add another inflation cycle, another policy mistake, or another independent example of a financial crisis.

Think of drawing cards from a deck and replacing each card after you inspect it. More draws help you estimate what is in that deck. They do not establish that tomorrow's game will use the same one.

The analogy has a limit. A rate model also has fitted dynamics. New sequences of familiar shocks can produce unfamiliar outcomes; simulated yields are more than shuffled copies of old yields. Even so, the process is constrained by the shocks and relationships it has been given.

A simulation can explore those assumptions thoroughly. Running longer does not validate them.

That leaves three questions worth separating.

**Have the calculations settled down?** An estimate near the edge of the simulated range can move around because of random sampling. More paths generally reduce that computational noise.

**How much relevant history supports the result?** Thousands of daily observations may contain relatively few distinct economic episodes. Reusing those days does not create more episodes.

**Are the model's rules a useful approximation of what comes next?** Relationships can change. Surprises can arrive in clusters that the sampling method does not preserve. Estimated parameters can be uncertain even when a simulation treats them as fixed.

More computation helps with the first question. The others require evidence and judgment.

This distinction also changes how we read the shaded band.

In MCS, the outer band runs from the fifth to the ninety-fifth percentile of simulated yields at each displayed future checkpoint. It contains the central 90% of that model-generated distribution.

Whether ranges constructed this way capture actual yields about 90% of the time requires a separate test: save predictions made with information available at the time, then compare them with what subsequently happened.

The shading does not conduct that test for you. Neither does the tasteful color palette.

The middle line needs interpretation too. The median is the middle of the simulated outcomes at a given checkpoint. Connecting those medians does not necessarily trace a journey any single simulation took.

So use the chart to make a discussion about uncertainty more specific. Which outcomes do its assumptions produce? Which choices move the result? Which risks sit outside its construction?

Then ask four questions of the forecast:

1. **What history is doing the work?** Look for the dates, the economic environments represented, and how much distinct experience they contain.
2. **What stays fixed?** Identify the relationships, estimated parameters, or policy assumptions the calculation takes as given.
3. **What does “90%” refer to?** A share of simulated outcomes, or coverage measured against outcomes the model had not yet seen?
4. **What has been tested?** How does it compare with a simple alternative, using only information available when each prediction was made?

These questions give a casual market reader a way into the chart and an experienced analyst a way to challenge it. They also give the model's builder something more useful to discuss than the number of paths their laptop survived.

Simulation earns its place by making the consequences of assumptions visible. Trust comes from examining the evidence behind those assumptions and testing the resulting predictions.

The computer can generate another 8,000 scenarios before lunch. It still cannot generate another past.

---

*Further reading: [Diebold and Li, Forecasting the Term Structure of Government Bond Yields](https://rodneywhitecenter.wharton.upenn.edu/wp-content/uploads/2014/04/0404.pdf), for the research background on describing yield curves through level, slope, and curvature.*
