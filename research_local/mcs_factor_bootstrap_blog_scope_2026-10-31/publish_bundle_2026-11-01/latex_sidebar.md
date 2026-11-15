## Optional sidebar: what the model actually computes

**1. Evolve three factors, keeping each sampled surprise together.**

$$
\boldsymbol{\beta}^{(i)}_{t+1}
=\widehat{\boldsymbol{c}}+\widehat{A}\boldsymbol{\beta}^{(i)}_t
+\widehat{\boldsymbol{\varepsilon}}_{J_{i,t}},
\qquad J_{i,t}\sim\operatorname{Unif}\{1,\ldots,N\}.
$$

The vector contains level, slope and curvature. Each step samples one whole historical error vector, with replacement. Here, $N=2{,}497$ and $i=1,\ldots,10{,}000$. The fitted intercept and coefficient matrix stay fixed during each path; residual draws are independent across steps, while factor dynamics still depend on the preceding state.

**2. Turn the factors into a yield at maturity $\tau$.**

$$
y^{(i)}_t(\tau)=\beta^{(i)}_{0,t}
+\beta^{(i)}_{1,t}g(x)
+\beta^{(i)}_{2,t}\bigl[g(x)-e^{-x}\bigr],
\qquad g(x)=\frac{1-e^{-x}}{x},\quad x=\frac{\tau}{\bar\lambda}.
$$

Maturity $\tau$ and decay scale $\bar\lambda$ use years. MCS fixes $\bar\lambda$ at the fitting window's average; this implementation divides maturity by the scale. Some references use the reciprocal convention. Yields here are in percent.

The shaded band joins the estimated 5th and 95th percentiles across the 10,000 simulated yields at each checkpoint. Its central 90% interpretation is conditional on the model; measured future coverage requires a separate evaluation.

**3. Optional front-end adjustment—off in this experiment.**

$$
q^{\mathrm{anchor}}_{p,h}(\tau)=q_{p,h}(\tau)
+w(\tau)\bigl[r_h-q_{0.5,h}(a)\bigr],
\qquad w(\tau)=\min\!\left(1,\max\!\left(0,e^{-(\tau-a)/k}\right)\right).
$$

Here $q_{p,h}(\tau)$ is a reported yield percentile, $r_h$ is the supplied meeting-path rate, $a=0.25$ years and $k=2$ years. Every percentile at a given maturity and horizon receives the same shift, preserving its reported interval width. This adjustment does not establish better calibration or an arbitrage-free curve.
